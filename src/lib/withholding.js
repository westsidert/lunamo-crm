import { supabase } from './supabase'

// ── 세액 계산 (인적용역 사업소득 3.3%) ──────────────────
// 소득세 = 지급액 x 3%, 지방소득세 = 소득세 x 10% (각각 10원 미만 절사, 국고금관리법 §47)
// 홈택스/위택스 자동계산값과 원단위 차이가 있을 수 있으므로 첫 신고 시 대조 권장
export const truncate10 = (n) => Math.floor((Number(n) || 0) / 10) * 10
export const calcIncomeTax = (amount) => truncate10((Number(amount) || 0) * 0.03)
export const calcLocalTax = (amount) => truncate10(calcIncomeTax(amount) * 0.1)
export const calcTotalWithholding = (amount) => calcIncomeTax(amount) + calcLocalTax(amount)

export const DEFAULT_BIZ_CODE = '940909' // 기타자영업

// 지금 신고해야 하는 귀속월 = 전월 ('YYYY-MM')
export const currentFilingPeriod = () => {
  const d = new Date()
  const y = d.getFullYear(), m = d.getMonth() // 0-based, m == 전월의 월 번호
  return m === 0 ? `${y - 1}-12` : `${y}-${String(m).padStart(2, '0')}`
}

// 'YYYY-MM' -> 해당 월 시작/끝 날짜
export const periodRange = (period) => {
  const [y, m] = period.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return { from: `${period}-01`, to: `${period}-${String(lastDay).padStart(2, '0')}` }
}

// 귀속월(지급월)의 원천세/지방세 신고 마감일: 다음달 10일
export const filingDeadline = (period) => {
  const [y, m] = period.split('-').map(Number)
  const ny = m === 12 ? y + 1 : y
  const nm = m === 12 ? 1 : m + 1
  return new Date(ny, nm - 1, 10)
}

// 간이지급명세서 제출 마감일: 다음달 말일
export const statementDeadline = (period) => {
  const [y, m] = period.split('-').map(Number)
  const ny = m === 12 ? y + 1 : y
  const nm = m === 12 ? 1 : m + 1
  return new Date(ny, nm, 0)
}

// ── 데이터 조회 ─────────────────────────────────────────
// period('YYYY-MM') 생략 시 전체 외주인건비 조회
export const getLaborTransactions = async (period) => {
  let query = supabase
    .from('transactions')
    .select('*, crew(id, name, rrn, biz_type_code), projects(name)')
    .eq('type', '외주인건비')
    .order('transaction_date')
  if (period) {
    const { from, to } = periodRange(period)
    query = query.gte('transaction_date', from).lte('transaction_date', to)
  }
  const { data, error } = await query
  if (error) throw error
  return data
}

export const linkTransactionCrew = async (txId, crewId) => {
  const { data, error } = await supabase
    .from('transactions')
    .update({ crew_id: crewId })
    .eq('id', txId)
    .select('*, crew(id, name, rrn, biz_type_code), projects(name)')
    .single()
  if (error) throw error
  return data
}

// ── 신고 상태 (tax_filings) ─────────────────────────────
export const getTaxFilings = async () => {
  const { data, error } = await supabase
    .from('tax_filings').select('*').order('period', { ascending: false })
  if (error) throw error
  return data
}

export const upsertTaxFiling = async (period, fields) => {
  const { data, error } = await supabase
    .from('tax_filings')
    .upsert({ period, ...fields, updated_at: new Date().toISOString() }, { onConflict: 'period' })
    .select()
    .single()
  if (error) throw error
  return data
}
