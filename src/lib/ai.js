export const hasAiKey = () => !!localStorage.getItem('anthropic_key')
export const getAiKey = () => localStorage.getItem('anthropic_key') || ''
export const setAiKey = (k) => localStorage.setItem('anthropic_key', k.trim())

export const getLogo  = () => localStorage.getItem('company_logo') || ''
export const getStamp = () => localStorage.getItem('company_stamp') || ''
export const setLogo  = (b64) => { b64 ? localStorage.setItem('company_logo', b64) : localStorage.removeItem('company_logo'); import('./settings').then(m => m.saveSetting('company_logo', b64 || null)) }
export const setStamp = (b64) => { b64 ? localStorage.setItem('company_stamp', b64) : localStorage.removeItem('company_stamp'); import('./settings').then(m => m.saveSetting('company_stamp', b64 || null)) }

// ─────────────────────────────────────────────────────────────────────
// 의뢰문과 가장 유사한 과거 견적 N건 추리기 (키워드 토큰 겹침 기반)
// ─────────────────────────────────────────────────────────────────────
const tokenize = (s) => (s || '').toLowerCase()
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .split(/\s+/)
  .filter(t => t.length >= 2)

const pickSimilarQuotes = (description, pastQuotes, n = 3) => {
  const descTokens = new Set(tokenize(description))
  if (descTokens.size === 0) return pastQuotes.slice(0, n)
  const scored = pastQuotes
    .filter(q => q.status === '수주')   // 신뢰도 높은 사례만
    .map(q => {
      const haystack = [q.project_title, ...(q.quote_items || []).map(i => i.contents || '')].join(' ')
      const tokens = new Set(tokenize(haystack))
      let score = 0
      descTokens.forEach(t => { if (tokens.has(t)) score++ })
      return { q, score }
    })
    .sort((a, b) => b.score - a.score)
  const top = scored.filter(x => x.score > 0).slice(0, n).map(x => x.q)
  // 유사 사례가 부족하면 최근 수주 견적으로 채움
  if (top.length < n) {
    const fallback = pastQuotes.filter(q => q.status === '수주' && !top.includes(q)).slice(0, n - top.length)
    return [...top, ...fallback]
  }
  return top
}

// ─────────────────────────────────────────────────────────────────────
// 거래처 fuzzy 매칭 (정규화 후 부분일치)
// ─────────────────────────────────────────────────────────────────────
const normalize = (s) => (s || '').replace(/\s|\(주\)|주식회사|㈜/g, '').toLowerCase()
export const matchClient = (clientName, clients = []) => {
  if (!clientName || !clients.length) return null
  const target = normalize(clientName)
  if (!target) return null
  // 1) exact normalized match
  let hit = clients.find(c => normalize(c.name) === target)
  if (hit) return hit
  // 2) 부분 포함 (양방향)
  hit = clients.find(c => {
    const n = normalize(c.name)
    return n && (n.includes(target) || target.includes(n))
  })
  return hit || null
}

// ─────────────────────────────────────────────────────────────────────
// 합계 계산 (예산 검증용)
// ─────────────────────────────────────────────────────────────────────
const calcResultSum = (items = []) =>
  items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 1) * (Number(it.day) || 1), 0)

// ─────────────────────────────────────────────────────────────────────
// AI 견적 분석
// ─────────────────────────────────────────────────────────────────────
const buildSystemPrompt = (allItems, similarQuotes) => {
  const itemsDesc = allItems
    .map(it => `[${it.cat} / ${it.sub}] ${it.name} — 기본단가 ${it.price.toLocaleString()}원`)
    .join('\n')

  const examplesDesc = similarQuotes.map((q, i) => {
    const rows = (q.quote_items || [])
      .map(it => `  · [${it.category}] ${it.contents}: ${Number(it.each_price).toLocaleString()}원 × ${it.qty}수량 × ${it.day}일`)
      .join('\n')
    return `[유사사례${i + 1}] "${q.project_title}" — 최종 ${Number(q.final_amount).toLocaleString()}원 (수주)\n${rows}`
  }).join('\n\n')

  return `당신은 루나모 영상 프로덕션의 견적 AI 어시스턴트입니다.
루나모는 부산 기반 영상 제작사로 기업홍보, 다큐, 광고, SNS 콘텐츠 등을 제작합니다.

## 의뢰 내용 분석 가이드라인

### 1. 영상 종류 (video_type) — 반드시 분류
- "홍보" : 기업/기관 일반 홍보영상 (3분 내외, 인터뷰+B-roll 위주)
- "광고" : TVC·온라인 광고 (15~60초, 모델·세트·연출 비중 ↑)
- "다큐" : 다큐멘터리·캠페인 (5~15분, 인터뷰·자막·번역 ↑)
- "SNS숏폼" : 릴스·쇼츠·틱톡 (15~60초, 빠른 컷 편집)
- "이벤트스케치" : 행사·세미나 기록 (3~5분, 다중 카메라)
- "인터뷰" : 인터뷰 위주 (긴 인터뷰 + 짧은 B-roll)
- "제품영상" : 제품 소개·언박싱 (1~2분, 클로즈업·CG 위주)

### 2. 결과물 스펙 (deliverables) — 가로/세로/길이/편수 분리
- 가로(16:9) 본편과 세로(9:16) 쇼츠는 별도 편집 공수 필요
- 예: 본편 3분 1편 + 쇼츠 30초 2편이면 deliverables 항목 2개

### 3. 영상 길이 → 편집 공수 환산
- 본편 3분 이하 = 편집 5~7일, 컬러 1일, 자막 1일
- 본편 5~10분 = 편집 7~10일
- 쇼츠 30~60초 1편 = 편집 1~2일 (본편이 있으면 절반 가산)
- CG 비중 높음 = 2D 그래픽 또는 3D 그래픽 추가

### 4. 촬영 조건 추출
- shoot_days: 명시 없으면 영상 종류·길이로 추정 (홍보 3분 = 1~2일, 다큐 = 2~3일, 광고 = 1~2일)
- interviewees: 인터뷰 인원 (있으면 사운드감독·사운드팀 추가)
- locations: 장소 수 (다중 장소면 차량대여·진행비 ↑)
- requires_drone, requires_cg, is_outdoor 추론

### 5. 예산 처리 (가장 중요)
- budget_total, budget_includes_vat 추출
- budget_priority: "strict" (절대 초과 금지) / "flexible" (±10%) / "quality_first" (품질 우선)
  - 공공기관·정부지원사업·"예산 X원으로" 같은 표현 → strict
  - "X원 정도" → flexible
- **budget_total이 있으면**, 합계가 정확히 그 예산에 맞도록 항목별 price·day·qty를 조정
  - budget_includes_vat=true → sum × 1.1 = budget_total → sum = budget_total / 1.1
  - budget_includes_vat=false → sum = budget_total
- 가격을 만원 단위로 떨어지게 조정 (절사 후 부가세 포함이 budget_total과 일치하도록)

### 6. 긴급도 (deadline_weeks)
- 2주 이하면 긴급 → 인건비·진행비 +15~20%

### 7. 메모 자동 생성 (memo)
- 견적서 하단에 들어갈 텍스트
- 예: "※ 최종 결과물\n- 바이럴 영상 (가로 3분 1편)\n- 쇼츠(릴스)용 세로 영상 30초 2편"
- deliverables 기반으로 자동 생성

## 사용 가능한 항목 목록
${itemsDesc}

${examplesDesc ? `## 의뢰 내용과 유사한 과거 수주 사례 (가격 구조를 강하게 따를 것)\n${examplesDesc}\n` : ''}
## 응답 규칙
- 반드시 JSON 형식만 응답 (코드블록·설명 없이 순수 JSON)
- 실제로 필요한 항목만 포함 (price·day·qty가 0이면 제외)
- day·qty는 양의 정수, price는 만원 단위로 떨어지는 숫자
- 항목 목록에 없는 경우 적절한 cat·sub로 추가 (cat은 'Pre-production'/'production'/'Post-production'/'기타' 중 하나)
- note: 산정 근거 + 예산 적용 방식 + 긴급도 반영 여부

## 응답 형식 (모든 필드 필수, 정보 없으면 null/빈문자열/false)
{
  "project_title": "프로젝트명",
  "client_name": "거래처명",
  "video_type": "홍보",
  "deliverables": [{"ratio":"16:9","duration":"3분","count":1}, {"ratio":"9:16","duration":"30초","count":2}],
  "shoot_days": 1,
  "interviewees": 0,
  "locations": 1,
  "requires_drone": false,
  "requires_cg": false,
  "is_outdoor": false,
  "deadline_weeks": null,
  "budget_total": 5000000,
  "budget_includes_vat": true,
  "budget_priority": "strict",
  "items": [{"cat":"Pre-production","sub":"기획","name":"기획료","day":2,"qty":1,"price":300000}],
  "memo": "※ 최종 결과물\\n- 바이럴 영상 (가로)\\n- 쇼츠(릴스)용 세로 영상",
  "note": "분석 근거..."
}`
}

const callAnthropic = async (key, system, userContent) => {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      system,
      messages: [{ role: 'user', content: userContent }],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `API 오류 (${res.status})`)
  }
  const data = await res.json()
  const text = data.content[0]?.text || ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('AI 응답을 파싱할 수 없습니다')
  return JSON.parse(match[0])
}

export const analyzeQuoteRequest = async (description, pastQuotes = [], allItems = []) => {
  const key = getAiKey()
  if (!key) throw new Error('Anthropic API 키가 설정되지 않았습니다')

  const similarQuotes = pickSimilarQuotes(description, pastQuotes, 3)
  const system = buildSystemPrompt(allItems, similarQuotes)

  // 1차 호출
  let result = await callAnthropic(key, system, `다음 프로젝트 의뢰 내용을 분석하여 가견적을 산출해주세요:\n\n${description}`)

  // 2차 검증·재조정 (예산 strict + 5% 이상 어긋날 때)
  if (result.budget_total && result.items && result.budget_priority !== 'quality_first') {
    const sum = calcResultSum(result.items)
    const target = result.budget_includes_vat
      ? Math.round(result.budget_total / 1.1)
      : result.budget_total
    const diff = Math.abs(sum - target) / target
    const tolerance = result.budget_priority === 'strict' ? 0.03 : 0.10
    if (diff > tolerance) {
      try {
        const reconciled = await callAnthropic(key, system,
          `이전 응답의 합계가 ${sum.toLocaleString()}원인데 목표 합계(부가세 ${result.budget_includes_vat ? '포함' : '별도'} ${result.budget_total.toLocaleString()}원 기준)는 ${target.toLocaleString()}원입니다. ` +
          `항목 구성은 유지하되 price·day·qty를 조정해서 합계가 ${target.toLocaleString()}원에 ±${Math.round(tolerance*100)}% 이내가 되도록 재산출해주세요. ` +
          `이전 응답의 다른 필드(project_title, client_name, video_type, deliverables, memo, note 등)는 그대로 유지하세요.\n\n원래 의뢰 내용:\n${description}\n\n이전 응답:\n${JSON.stringify(result)}`)
        // 재조정 결과의 items만 채택, 다른 필드는 원본 유지
        if (reconciled.items && reconciled.items.length) {
          result = { ...result, items: reconciled.items, note: (result.note || '') + ' (예산 일치 재조정 적용)' }
        }
      } catch (e) {
        // 재조정 실패해도 1차 결과 사용
        console.warn('[AI 견적] 예산 재조정 실패:', e.message)
      }
    }
  }

  return result
}
