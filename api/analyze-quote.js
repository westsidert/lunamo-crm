// 견적 AI 분석 — 서버사이드 (브라우저에 Anthropic 키 노출 방지)
// 인증: Supabase 세션 JWT (Authorization: Bearer <access_token>)
import { createClient } from '@supabase/supabase-js'

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
  const { system, userContent } = req.body || {}
  if (!system || !userContent) return res.status(400).json({ error: 'system, userContent 필수' })
  if (typeof system !== 'string' || typeof userContent !== 'string'
    || system.length > 100000 || userContent.length > 50000) {
    return res.status(400).json({ error: '입력 형식 오류' })
  }

  // ── Anthropic 호출 ──
  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 4096,
        system,
        messages: [{ role: 'user', content: userContent }],
      }),
    })
    if (!aiRes.ok) {
      const err = await aiRes.json().catch(() => ({}))
      return res.status(aiRes.status).json({ error: err.error?.message || `Anthropic API 오류 (${aiRes.status})` })
    }
    const data = await aiRes.json()
    return res.status(200).json({ text: data.content?.[0]?.text || '' })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
