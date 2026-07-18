// 견적 AI 분석 - 서버사이드 (브라우저에 Anthropic 키 노출 방지)
// 인증: Supabase 세션 JWT (Authorization: Bearer <access_token>)
import { createClient } from '@supabase/supabase-js'

// 견적 응답 스키마 (structured outputs) - 서버가 보관해 클라이언트-서버 버전 스큐와
// 임의 스키마 주입을 차단. src/lib/ai.js의 파싱·후처리와 형식을 맞출 것.
const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'project_title', 'client_name', 'video_type', 'deliverables',
    'shoot_days', 'interviewees', 'locations',
    'requires_drone', 'requires_cg', 'is_outdoor',
    'deadline_weeks', 'budget_total', 'budget_includes_vat', 'budget_priority',
    'items', 'clarifying_questions', 'memo', 'note',
  ],
  properties: {
    project_title: { type: 'string' },
    client_name: { type: 'string' },
    video_type: { enum: ['홍보', '광고', '다큐', 'SNS숏폼', '이벤트스케치', '인터뷰', '제품영상', '기타'] },
    deliverables: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['ratio', 'duration', 'count'],
        properties: { ratio: { type: 'string' }, duration: { type: 'string' }, count: { type: 'integer' } },
      },
    },
    shoot_days: { type: 'integer' },
    interviewees: { type: 'integer' },
    locations: { type: 'integer' },
    requires_drone: { type: 'boolean' },
    requires_cg: { type: 'boolean' },
    is_outdoor: { type: 'boolean' },
    deadline_weeks: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    budget_total: { anyOf: [{ type: 'number' }, { type: 'null' }] },
    budget_includes_vat: { type: 'boolean' },
    budget_priority: { enum: ['strict', 'flexible', 'quality_first'] },
    items: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['cat', 'sub', 'name', 'day', 'qty', 'price', 'basis'],
        properties: {
          cat: { enum: ['Pre-production', 'production', 'Post-production', '기타'] },
          sub: { type: 'string' },
          name: { type: 'string' },
          day: { type: 'integer' },
          qty: { type: 'integer' },
          price: { type: 'number' },
          basis: { type: 'string' },
        },
      },
    },
    clarifying_questions: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['question', 'options'],
        properties: {
          question: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    memo: { type: 'string' },
    note: { type: 'string' },
  },
}

// 비교견적서 생성용 스키마 (두 경쟁사 스타일의 항목 구성)
const COMP_ITEM_DEF = {
  type: 'array',
  items: {
    type: 'object', additionalProperties: false,
    required: ['cat', 'name', 'price'],
    properties: {
      cat: { enum: ['Pre-production', 'production', 'Post-production', '기타'] },
      name: { type: 'string' },
      price: { type: 'number' },
    },
  },
}
const COMPARISON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['traditional_items', 'modern_items'],
  properties: {
    traditional_items: COMP_ITEM_DEF,
    modern_items: COMP_ITEM_DEF,
  },
}

// 생성 후 대화형 수정용 스키마 (항목 목록 + 예산 변경만)
const REFINE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items', 'budget_total', 'budget_includes_vat', 'note'],
  properties: {
    items: RESPONSE_SCHEMA.properties.items,
    budget_total: { anyOf: [{ type: 'number' }, { type: 'null' }] },
    budget_includes_vat: { type: 'boolean' },
    note: { type: 'string' },
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // ── 인증 검증 ──
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: '인증 필요' })

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
  )
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: '유효하지 않은 세션' })

  // ── 입력 ──
  const { system, userContent, mode = 'analyze' } = req.body || {}
  if (!system || !userContent) return res.status(400).json({ error: 'system, userContent 필수' })
  if (typeof system !== 'string' || typeof userContent !== 'string'
    || system.length > 100000 || userContent.length > 50000) {
    return res.status(400).json({ error: '입력 형식 오류' })
  }
  if (!['analyze', 'refine', 'comparison'].includes(mode)) {
    return res.status(400).json({ error: 'mode 형식 오류' })
  }

  // ── Anthropic 호출 ──
  // adaptive thinking(다단계 추론) + structured outputs(JSON 스키마 강제)
  try {
    const body = {
      model: 'claude-opus-4-8',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { format: { type: 'json_schema', schema:
        mode === 'refine' ? REFINE_SCHEMA
        : mode === 'comparison' ? COMPARISON_SCHEMA
        : RESPONSE_SCHEMA } },
      system,
      messages: [{ role: 'user', content: userContent }],
    }

    // 일시 오류(과부하 529, 레이트리밋 429, 5xx)는 백오프 후 자동 재시도
    const RETRYABLE = [429, 500, 502, 503, 529]
    const sleep = (ms) => new Promise(r => setTimeout(r, ms))
    let aiRes
    for (let attempt = 0; ; attempt++) {
      try {
        aiRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(body),
        })
      } catch (e) {
        if (attempt >= 2) throw e
        await sleep((attempt + 1) * 2000)
        continue
      }
      if (RETRYABLE.includes(aiRes.status) && attempt < 2) {
        await sleep((attempt + 1) * 2000)
        continue
      }
      break
    }
    if (!aiRes.ok) {
      const err = await aiRes.json().catch(() => ({}))
      const raw = err.error?.message || ''
      const friendly =
        aiRes.status === 529 ? 'AI 서버가 일시적으로 혼잡합니다. 잠시 후 다시 시도해주세요.'
        : aiRes.status === 429 ? '요청이 몰려 잠시 제한되었습니다. 잠시 후 다시 시도해주세요.'
        : aiRes.status >= 500 ? 'AI 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
        : raw || `Anthropic API 오류 (${aiRes.status})`
      return res.status(aiRes.status).json({ error: friendly })
    }
    const data = await aiRes.json()
    if (data.stop_reason === 'refusal') {
      return res.status(422).json({ error: 'AI가 요청을 처리할 수 없습니다. 의뢰 내용을 바꿔서 다시 시도해주세요.' })
    }
    // thinking 블록이 앞에 올 수 있으므로 text 블록을 찾아서 반환
    const textBlock = (data.content || []).find(b => b.type === 'text')
    if (!textBlock?.text) {
      const reason = data.stop_reason === 'max_tokens'
        ? 'AI 응답이 길이 제한에 걸렸습니다'
        : 'AI 응답이 비어 있습니다'
      return res.status(502).json({ error: `${reason}. 다시 시도해주세요.` })
    }
    return res.status(200).json({ text: textBlock.text })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
