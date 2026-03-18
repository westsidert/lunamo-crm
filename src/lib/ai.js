export const hasAiKey = () => !!localStorage.getItem('anthropic_key')
export const getAiKey = () => localStorage.getItem('anthropic_key') || ''
export const setAiKey = (k) => localStorage.setItem('anthropic_key', k.trim())

export const getLogo  = () => localStorage.getItem('company_logo') || ''
export const getStamp = () => localStorage.getItem('company_stamp') || ''
export const setLogo  = (b64) => { b64 ? localStorage.setItem('company_logo', b64) : localStorage.removeItem('company_logo'); import('./settings').then(m => m.saveSetting('company_logo', b64 || null)) }
export const setStamp = (b64) => { b64 ? localStorage.setItem('company_stamp', b64) : localStorage.removeItem('company_stamp'); import('./settings').then(m => m.saveSetting('company_stamp', b64 || null)) }

export const analyzeQuoteRequest = async (description, pastQuotes = [], allItems = []) => {
  const key = getAiKey()
  if (!key) throw new Error('Anthropic API 키가 설정되지 않았습니다')

  const itemsDesc = allItems
    .map(it => `[${it.cat} / ${it.sub}] ${it.name} — 기본단가 ${it.price.toLocaleString()}원`)
    .join('\n')

  const examplesDesc = pastQuotes.slice(0, 10).map((q, i) => {
    const rows = (q.quote_items || [])
      .map(it => `  · [${it.category}] ${it.contents}: ${Number(it.each_price).toLocaleString()}원 × ${it.qty}수량 × ${it.day}일`)
      .join('\n')
    return `[예시${i + 1}] "${q.project_title}" — 최종 ${Number(q.final_amount).toLocaleString()}원\n${rows}`
  }).join('\n\n')

  const system = `당신은 루나모 영상 프로덕션의 견적 AI 어시스턴트입니다.
고객의 프로젝트 의뢰 내용을 분석하여 적합한 견적 항목·소요일·수량·단가를 추천합니다.
루나모는 부산 기반 영상 제작사로 기업홍보, 다큐, 광고, SNS 콘텐츠 등을 제작합니다.

## 사용 가능한 항목 목록
${itemsDesc}

${examplesDesc ? `## 과거 견적 참고 사례 (실제 수주 금액 기준)\n${examplesDesc}\n` : ''}
## 응답 규칙
- 반드시 JSON 형식만 응답 (코드블록·설명 없이 순수 JSON)
- 실제로 필요한 항목만 포함 (0인 항목 제외)
- day·qty는 양의 정수, price는 숫자
- 항목 목록에 없는 경우 적절한 cat·sub를 지정하여 추가 가능
- note 필드: 주요 가정과 산정 근거를 한두 문장으로

## 응답 형식
{"items":[{"cat":"Pre-production","sub":"기획","name":"기획료","day":2,"qty":1,"price":300000}],"note":"분석 근거..."}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system,
      messages: [{ role: 'user', content: `다음 프로젝트 의뢰 내용을 분석하여 가견적을 산출해주세요:\n\n${description}` }],
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
