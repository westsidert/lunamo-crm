import { supabase } from './supabase'
import { sumQuoteItems } from './utils'
import { fetchQuoteFeedback } from './aiFeedback'

// AI 호출이 서버사이드(api/analyze-quote.js)로 이전되어 브라우저 키 불필요.
// 응답 JSON 스키마도 서버(api/analyze-quote.js)가 보관한다.
// 과거 localStorage에 저장된 키는 제거.
try { localStorage.removeItem('anthropic_key') } catch { /* SSR 등 */ }

export const getLogo  = () => localStorage.getItem('company_logo') || ''
export const getStamp = () => localStorage.getItem('company_stamp') || ''
export const setLogo  = (b64) => { b64 ? localStorage.setItem('company_logo', b64) : localStorage.removeItem('company_logo'); import('./settings').then(m => m.saveSetting('company_logo', b64 || null)) }
export const setStamp = (b64) => { b64 ? localStorage.setItem('company_stamp', b64) : localStorage.removeItem('company_stamp'); import('./settings').then(m => m.saveSetting('company_stamp', b64 || null)) }

// ─────────────────────────────────────────────────────────────────────
// 의뢰문과 가장 유사한 과거 견적 추리기 (키워드 토큰 겹침 기반)
// 겹치는 사례가 없으면 최근 수주 사례를 "유사도 낮음" 라벨로 대체 주입
// ─────────────────────────────────────────────────────────────────────
const tokenize = (s) => (s || '').toLowerCase()
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .split(/\s+/)
  .filter(t => t.length >= 2)

const pickSimilarQuotes = (description, pastQuotes, n = 3) => {
  const descTokens = new Set(tokenize(description))
  const recentWon = () => pastQuotes
    .filter(q => q.status === '수주')
    .slice(0, 2)
    .map(quote => ({ quote, lowSim: true }))
  if (descTokens.size === 0) return recentWon()

  const picked = pastQuotes
    .filter(q => q.status === '수주' || q.status === '미수주')
    .map(q => {
      const haystack = [q.project_title, ...(q.quote_items || []).map(i => i.contents || '')].join(' ')
      const tokens = new Set(tokenize(haystack))
      let score = 0
      descTokens.forEach(t => { if (tokens.has(t)) score++ })
      return { q, score }
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || (b.q.status === '수주') - (a.q.status === '수주'))
    .slice(0, n)
    .map(x => ({ quote: x.q, lowSim: false }))

  return picked.length > 0 ? picked : recentWon()
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
// 예산 맞춤 - 산수는 AI가 아니라 코드가 담당
// 모든 단가를 만원 단위로 유지한 채, 견적서 최종금액(calcTotals와 동일:
// floor(round(공급가합계 × 1.1) / 10000) × 10000)이 예산을 넘지 않는
// 최대 공급가를 목표로 잡고, 비율 스케일링 + 만원 단위 반복 흡수로 맞춘다.
// ─────────────────────────────────────────────────────────────────────
const finalAmountOf = (supply) => Math.floor(Math.round(supply * 1.1) / 10000) * 10000

export const fitItemsToBudget = (items, budgetTotal, includesVat) => {
  const budget = Number(budgetTotal) || 0
  if (budget <= 0 || !Array.isArray(items) || items.length === 0) {
    return { items, adjusted: false, expectedFinal: null }
  }
  const list = items.map(it => ({
    ...it,
    price: Number(it.price) || 0,
    qty: Math.max(1, Math.round(Number(it.qty) || 1)),
    day: Math.max(1, Math.round(Number(it.day) || 1)),
  }))

  // 목표 공급가: 만원 단위 값 중 최종금액이 예산을 넘지 않는 최대값
  let target
  if (includesVat) {
    target = Math.floor(budget / 1.1 / 10000) * 10000
    while (finalAmountOf(target + 10000) <= budget) target += 10000
  } else {
    target = Math.floor(budget / 10000) * 10000
  }
  const cur = sumQuoteItems(list)
  if (target <= 0 || cur <= 0) return { items: list, adjusted: false, expectedFinal: null }
  if (cur === target) return { items: list, adjusted: false, expectedFinal: finalAmountOf(cur) }

  // 1) 비율 유지 스케일링 (만원 단위, 최소 1만원)
  const scale = target / cur
  const scaled = list.map(it => ({
    ...it,
    price: Math.max(10000, Math.round(it.price * scale / 10000) * 10000),
  }))

  // 2) 잔차를 만원 단위 스텝으로 여러 항목에 반복 흡수 (qty×day 작은 항목부터)
  let residual = target - sumQuoteItems(scaled)
  const order = scaled.map((_, i) => i)
    .sort((a, b) => (scaled[a].qty * scaled[a].day) - (scaled[b].qty * scaled[b].day))
  for (const i of order) {
    if (residual === 0) break
    const k = scaled[i].qty * scaled[i].day
    const step = 10000 * k
    let units = Math.trunc(residual / step)
    // 단가 최소 1만원 유지 (감소 하한)
    const minUnits = Math.ceil((10000 - scaled[i].price) / 10000)
    if (units < minUnits) units = minUnits
    if (units !== 0) {
      scaled[i] = { ...scaled[i], price: scaled[i].price + units * 10000 }
      residual -= units * step
    }
  }
  // 3) 흡수 불가 잔차로 예산을 초과하면 만원 스텝으로 낮춰 초과 방지 (strict 안전)
  //    (모든 항목의 qty×day > 1이면 만원 스텝 흡수가 불가능한 잔차가 남을 수 있음)
  const exceedsBudget = () => includesVat
    ? finalAmountOf(sumQuoteItems(scaled)) > budget
    : sumQuoteItems(scaled) > budget
  let guard = 0
  while (exceedsBudget() && guard < 100) {
    let lowered = false
    for (const i of order) {
      if (scaled[i].price - 10000 >= 10000) {
        scaled[i] = { ...scaled[i], price: scaled[i].price - 10000 }
        lowered = true
        break
      }
    }
    if (!lowered) break
    guard++
  }

  // 남은 잔차는 만원 미만 끝수이거나 흡수 불가한 경우 - 최종금액은 실제 합계 기준으로 보고
  return { items: scaled, adjusted: true, expectedFinal: finalAmountOf(sumQuoteItems(scaled)) }
}

// ─────────────────────────────────────────────────────────────────────
// 시스템 프롬프트
// ─────────────────────────────────────────────────────────────────────
const buildSystemPrompt = (allItems, similarQuotes, feedbackCases) => {
  const itemsDesc = allItems
    .map(it => `[${it.cat} / ${it.sub}] ${it.name} : 기본단가 ${it.price.toLocaleString()}원`)
    .join('\n')

  const examplesDesc = similarQuotes.map(({ quote: q, lowSim }, i) => {
    const rows = (q.quote_items || [])
      .map(it => `  · [${it.category}] ${it.contents}: ${Number(it.each_price).toLocaleString()}원 × ${it.qty}수량 × ${it.day}일`)
      .join('\n')
    const label = lowSim
      ? '최근 수주 사례 (직접 유사하진 않음, 가격 감각 참고용)'
      : q.status === '수주' ? '수주 성공' : '미수주 (이 가격 구성으로는 성사되지 않았음)'
    return `[사례${i + 1}] "${q.project_title}" : 최종 ${Number(q.final_amount).toLocaleString()}원 (${label})\n${rows}`
  }).join('\n\n')

  const feedbackDesc = (feedbackCases || []).map((f, i) => {
    const head = f.video_type ? `(${f.video_type}) ` : ''
    const desc = (f.description || '').slice(0, 80)
    const totals = (f.ai_total != null && f.final_total != null)
      ? ` / AI 초안 ${Number(f.ai_total).toLocaleString()}원 → 확정 ${Number(f.final_total).toLocaleString()}원`
      : ''
    return `[수정사례${i + 1}] ${head}"${desc}"${totals}\n  수정 내용: ${f.diff_summary || '수정 없음 (초안 그대로 채택)'}`
  }).join('\n')

  return `당신은 루나모 영상 프로덕션의 견적 AI 어시스턴트입니다.
루나모는 부산 기반 영상 제작사로 기업홍보, 다큐, 광고, SNS 콘텐츠 등을 제작합니다.
목표: 대표가 직접 짠 것과 구분되지 않는 수준의 현실적인 견적 초안.

## 의뢰 내용 분석 가이드라인

### 1. 영상 종류 (video_type)
- "홍보" : 기업/기관 일반 홍보영상 (3분 내외, 인터뷰+B-roll 위주)
- "광고" : TVC·온라인 광고 (15~60초, 모델·세트·연출 비중 ↑)
- "다큐" : 다큐멘터리·캠페인 (5~15분, 인터뷰·자막·번역 ↑)
- "SNS숏폼" : 릴스·쇼츠·틱톡 (15~60초, 빠른 컷 편집)
- "이벤트스케치" : 행사·세미나 기록 (3~5분, 다중 카메라)
- "인터뷰" : 인터뷰 위주 (긴 인터뷰 + 짧은 B-roll)
- "제품영상" : 제품 소개·언박싱 (1~2분, 클로즈업·CG 위주)

### 2. 결과물 스펙 (deliverables) : 가로/세로/길이/편수 분리
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

### 5. 예산 처리
- budget_total(원 단위 숫자, 예: 500만원 → 5000000), budget_includes_vat 추출
- budget_priority: "strict" (절대 초과 금지) / "flexible" (±10%) / "quality_first" (품질 우선)
  - 공공기관·정부지원사업·"예산 X원으로" 같은 표현 → strict
  - "X원 정도" → flexible
- 정확한 합계 일치는 시스템이 자동 처리하므로 산수에 집착하지 말 것.
  당신의 역할은 예산 규모에 맞는 **항목 구성과 상대적 비중**을 잡는 것.
  합계(price×qty×day의 총합, 부가세 별도 기준)가 예산 공급가 대비 ±15% 이내면 충분함.

### 6. 긴급도 (deadline_weeks)
- 2주 이하면 긴급 → 인건비·진행비 +15~20%

### 7. 항목별 근거 (basis)
- 각 항목의 basis에 그 금액·일수를 잡은 이유를 한 문장으로 (예: "3분 본편 기준 편집 6일, 사례1과 동일 단가")

### 8. 확인 질문 (clarifying_questions)
- 견적 금액에 큰 영향을 주는 핵심 변수(예산, 촬영일수, 영상 분량/편수, 인터뷰 유무, 마감)가
  의뢰문에서 파악되지 않으면 최대 3개까지 질문을 생성. 각 질문에 선택지 2~4개 포함.
- 정보가 충분하면 빈 배열. 사소한 것은 묻지 말 것.
- 질문이 있어도 items는 최선의 추정으로 반드시 채울 것 (사용자가 질문을 건너뛸 수 있음).
- 사용자 답변이 이미 제공된 재분석 요청이면 clarifying_questions는 빈 배열로.

### 9. 메모 자동 생성 (memo)
- 견적서 하단에 들어갈 텍스트, deliverables 기반
- 예: "※ 최종 결과물\\n- 바이럴 영상 (가로 3분 1편)\\n- 쇼츠(릴스)용 세로 영상 30초 2편"

## 사용 가능한 항목 목록
${itemsDesc}

${examplesDesc ? `## 과거 견적 사례 (수주 사례의 가격 구조를 강하게 따를 것)\n${examplesDesc}\n` : ''}
${feedbackDesc ? `## 과거 AI 초안을 대표가 수정한 기록 (대표의 가격 감각, 같은 실수를 반복하지 말 것)\n${feedbackDesc}\n` : ''}
## 응답 규칙
- 실제로 필요한 항목만 포함 (불필요한 항목을 채우지 말 것)
- day·qty는 양의 정수, price는 만원 단위
- 항목 목록에 없는 작업이 필요하면 적절한 cat·sub로 추가
- note: 전체 산정 근거 요약 (2~4문장, 예산·긴급도 반영 여부 포함)
- 정보가 없는 필드는 빈 문자열/0/false/null
- 텍스트에 대시가 필요하면 하이픈(-)만 사용`
}

// ─────────────────────────────────────────────────────────────────────
// 서버 API 호출
// ─────────────────────────────────────────────────────────────────────
const callAnalyzeApi = async (system, userContent, mode = 'analyze') => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('로그인이 필요합니다')

  const res = await fetch('/api/analyze-quote', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ system, userContent, mode }),
  })
  if (!res.ok) {
    if (res.status === 504) throw new Error('분석 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.')
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `API 오류 (${res.status})`)
  }
  const { text } = await res.json()
  try {
    return JSON.parse(text)
  } catch { /* 아래 방어적 파싱으로 진행 */ }
  const match = (text || '').match(/\{[\s\S]*\}/)
  if (!match) throw new Error('AI 응답을 파싱할 수 없습니다. 다시 시도해주세요.')
  try {
    return JSON.parse(match[0])
  } catch {
    throw new Error('AI 응답이 불완전합니다. 다시 시도해주세요.')
  }
}

// ─────────────────────────────────────────────────────────────────────
// AI 견적 분석 (메인 진입점)
// opts.answers: [{ question, answer }] - 확인 질문에 대한 사용자 답변 (재분석)
// ─────────────────────────────────────────────────────────────────────
export const analyzeQuoteRequest = async (description, pastQuotes = [], allItems = [], opts = {}) => {
  const similarQuotes = pickSimilarQuotes(description, pastQuotes, 3)

  // 피드백 사례 (실패해도 분석은 계속)
  let feedbackCases = []
  try {
    feedbackCases = await fetchQuoteFeedback(4)
  } catch (e) {
    console.warn('[AI 견적] 피드백 사례 로드 실패:', e.message)
  }

  const system = buildSystemPrompt(allItems, similarQuotes, feedbackCases)

  let userContent = `다음 프로젝트 의뢰 내용을 분석하여 가견적을 산출해주세요:\n\n${description}`
  if (opts.answers?.length) {
    const answersText = opts.answers
      .filter(a => (a.answer || '').trim())
      .map(a => `Q. ${a.question}\nA. ${a.answer}`)
      .join('\n')
    userContent += `\n\n## 확인 질문에 대한 사용자 답변 (반영해서 재산출, 추가 질문 금지)\n${answersText}`
  }

  const result = await callAnalyzeApi(system, userContent)

  // 예산 맞춤은 코드가 처리 (quality_first는 예산보다 품질 우선이므로 제외)
  if (result.budget_total && result.items?.length && result.budget_priority !== 'quality_first') {
    const { items, adjusted, expectedFinal } = fitItemsToBudget(
      result.items, result.budget_total, result.budget_includes_vat,
    )
    if (adjusted) {
      result.items = items
      result.note = (result.note || '')
        + ` (예산 ${Number(result.budget_total).toLocaleString()}원${result.budget_includes_vat ? ' VAT포함' : ''} 기준,`
        + ` 견적 최종금액 ${expectedFinal.toLocaleString()}원으로 자동 조정)`
    }
  }

  // 재분석(답변 반영)에서는 질문을 다시 받지 않음
  if (opts.answers?.length) result.clarifying_questions = []

  return result
}

// ─────────────────────────────────────────────────────────────────────
// 생성 후 대화형 수정 (자유 지시 → 항목 구조 수정은 AI, 예산 재맞춤은 코드)
// currentItems: [{ cat, sub, name, day, qty, price, basis? }]
// budget: { total, includesVat } | null  (현재 목표 예산, 없으면 null)
// 반환: { items, note, budget: {total, includesVat} | null, expectedFinal | null }
// ─────────────────────────────────────────────────────────────────────
const buildRefinePrompt = (allItems) => {
  const itemsDesc = allItems
    .map(it => `[${it.cat} / ${it.sub}] ${it.name} : 기본단가 ${it.price.toLocaleString()}원`)
    .join('\n')
  return `당신은 루나모 영상 프로덕션의 견적 수정 어시스턴트입니다.
현재 견적 항목 목록과 사용자의 수정 지시가 주어집니다.
지시를 적용한 "전체 항목 목록"을 반환하세요.

## 규칙
- 지시와 무관한 항목은 그대로 유지할 것 (이름·단가·일수·수량을 임의로 바꾸지 말 것)
- 지시된 삭제·추가·수량/일수/단가 변경은 정확히 반영
- 항목 추가 시 아래 단가표의 기본단가를 참고, 표에 없는 항목은 업계 관행에 맞는 합리적 단가로 추가
- 사용자가 새 목표 예산을 언급하면 budget_total(원 단위 숫자, 예: 500만원 → 5000000)과
  budget_includes_vat에 반영. 예산 언급이 없으면 budget_total은 null
- 예산 합계 산수는 시스템이 자동 처리하므로 스스로 합계를 맞추려고 단가를 조정하지 말 것
- basis: 새로 추가되거나 변경된 항목만 이유 한 문장, 유지된 항목은 기존 근거를 그대로
- note: 무엇을 어떻게 바꿨는지 1~2문장
- day·qty는 양의 정수, price는 만원 단위, 텍스트 대시는 하이픈(-)만 사용

## 사용 가능한 항목 목록 (단가표)
${itemsDesc}`
}

export const refineQuoteItems = async ({ items, instruction, budget = null, allItems = [] }) => {
  const currentDesc = (items || []).map(it =>
    `- [${it.cat}${it.sub ? ` / ${it.sub}` : ''}] ${it.name} : ${Number(it.price).toLocaleString()}원 × ${it.qty}수량 × ${it.day}일${it.basis ? ` (근거: ${it.basis})` : ''}`
  ).join('\n')
  const budgetDesc = budget?.total
    ? `${Number(budget.total).toLocaleString()}원 (${budget.includesVat ? 'VAT 포함' : 'VAT 별도'})`
    : '설정 안 됨'

  const userContent = `## 현재 견적 항목
${currentDesc || '(없음)'}

## 현재 목표 예산
${budgetDesc}

## 수정 지시
${instruction}`

  const result = await callAnalyzeApi(buildRefinePrompt(allItems), userContent, 'refine')

  // 예산 결정: 지시에 새 예산이 있으면 그것, 없으면 기존 예산 유지
  const nextBudget = result.budget_total
    ? { total: Number(result.budget_total), includesVat: !!result.budget_includes_vat }
    : budget

  let refined = result.items || []
  let expectedFinal = null
  if (nextBudget?.total && refined.length) {
    const fit = fitItemsToBudget(refined, nextBudget.total, nextBudget.includesVat)
    if (fit.adjusted || fit.expectedFinal != null) {
      refined = fit.items
      expectedFinal = fit.expectedFinal
    }
  }

  let note = result.note || ''
  if (expectedFinal != null && nextBudget?.total) {
    note += ` (예산 ${Number(nextBudget.total).toLocaleString()}원${nextBudget.includesVat ? ' VAT포함' : ''} 기준,`
      + ` 견적 최종금액 ${expectedFinal.toLocaleString()}원으로 자동 조정)`
  }

  return { items: refined, note, budget: nextBudget, expectedFinal }
}
