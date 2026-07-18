import { supabase } from './supabase'
import { formatKRW, sumQuoteItems } from './utils'

// ─────────────────────────────────────────────────────────────────────
// AI 견적 피드백 루프
// AI 초안 vs 사용자 확정본을 기록해 다음 분석 프롬프트에 "대표의 수정 사례"로 주입
// ─────────────────────────────────────────────────────────────────────

// 최근 피드백 사례 조회 (프롬프트 주입용)
export const fetchQuoteFeedback = async (limit = 4) => {
  const { data, error } = await supabase
    .from('quote_ai_feedback')
    .select('video_type, description, ai_total, final_total, diff_summary')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

// AI 초안 vs 확정 항목 diff → 한 줄 요약
// 이름 기준 매칭 후, 제거·추가 쌍 중 cat과 price·qty·day가 동일한 쌍은 '이름변경'으로 처리
// (nameOverride로 이름만 바꾼 경우를 제거+추가로 오기록하지 않기 위함)
export const buildDiffSummary = (aiItems, finalItems) => {
  const key = (it) => (it.name || '').trim()
  const aiMap = new Map((aiItems || []).map(it => [key(it), it]))
  const finalMap = new Map((finalItems || []).map(it => [key(it), it]))

  let added = (finalItems || []).filter(it => key(it) && !aiMap.has(key(it)))
  let removed = (aiItems || []).filter(it => key(it) && !finalMap.has(key(it)))

  // 이름변경 감지: cat·price·qty·day가 모두 같은 제거·추가 쌍
  const renamed = []
  removed = removed.filter(r => {
    const matchIdx = added.findIndex(a =>
      a.cat === r.cat
      && Number(a.price) === Number(r.price)
      && Number(a.qty) === Number(r.qty)
      && Number(a.day) === Number(r.day))
    if (matchIdx === -1) return true
    renamed.push(`${key(r)}→${key(added[matchIdx])}`)
    added = added.filter((_, i) => i !== matchIdx)
    return false
  })

  const changed = []
  ;(finalItems || []).forEach(f => {
    const a = aiMap.get(key(f))
    if (!a) return
    const parts = []
    if (Number(a.price) !== Number(f.price)) parts.push(`단가 ${formatKRW(a.price)}→${formatKRW(f.price)}`)
    if (Number(a.day) !== Number(f.day)) parts.push(`일수 ${a.day}→${f.day}`)
    if (Number(a.qty) !== Number(f.qty)) parts.push(`수량 ${a.qty}→${f.qty}`)
    if (parts.length) changed.push(`${key(f)}(${parts.join(', ')})`)
  })

  const segs = []
  if (added.length) segs.push('추가: ' + added.map(it => `${key(it)} ${formatKRW(it.price)}원`).join(', '))
  if (removed.length) segs.push('제거: ' + removed.map(it => key(it)).join(', '))
  if (changed.length) segs.push('변경: ' + changed.join(', '))
  if (renamed.length) segs.push('이름변경: ' + renamed.join(', '))
  return segs.join(' · ') || '수정 없음 (초안 그대로 채택)'
}

// 견적 저장 시 호출 - AI 초안과 최종본을 비교해 기록
// aiResult: analyzeQuoteRequest 반환값 / finalItems: 저장된 quote_items 형태
export const saveQuoteAiFeedback = async ({ quoteId, description, aiResult, finalItems }) => {
  const aiItems = (aiResult?.items || []).map(it => ({
    name: it.name, cat: it.cat, day: Number(it.day) || 1, qty: Number(it.qty) || 1, price: Number(it.price) || 0,
  }))
  const fItems = (finalItems || []).map(it => ({
    name: it.contents, cat: it.category, day: Number(it.day) || 1, qty: Number(it.qty) || 1, price: Number(it.each_price) || 0,
  }))
  const payload = {
    quote_id: quoteId || null,
    description: (description || '').slice(0, 2000),
    video_type: aiResult?.video_type || null,
    ai_items: aiItems,
    final_items: fItems,
    ai_total: sumQuoteItems(aiItems),
    final_total: sumQuoteItems(fItems),
    diff_summary: buildDiffSummary(aiItems, fItems),
  }
  const { error } = await supabase.from('quote_ai_feedback').insert(payload)
  if (error) throw error
}
