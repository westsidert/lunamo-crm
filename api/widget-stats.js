import { createClient } from '@supabase/supabase-js'

// 데스크톱 위젯(Übersicht / SwiftBar)용 요약 통계
// 인증: ?token=<WIDGET_TOKEN> (집계 숫자만 반환, 개인정보 없음)
// 세액 계산은 src/lib/withholding.js와 동일 규칙 (소득세 3%, 지방세 10%, 각 10원 절사)
const truncate10 = (n) => Math.floor((Number(n) || 0) / 10) * 10
const calcIncomeTax = (amount) => truncate10((Number(amount) || 0) * 0.03)
const calcLocalTax = (amount) => truncate10(calcIncomeTax(amount) * 0.1)

export default async function handler(req, res) {
  const expected = process.env.WIDGET_TOKEN
  const token = req.query?.token || ''
  if (!expected || token !== expected) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  // KST 기준 날짜
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const pad = (n) => String(n).padStart(2, '0')
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const monthFrom = `${y}-${pad(m)}-01`
  const monthTo = `${y}-${pad(m)}-${new Date(y, m, 0).getDate()}`
  // 전월(원천세 귀속월)
  const py = m === 1 ? y - 1 : y
  const pm = m === 1 ? 12 : m - 1
  const prevPeriod = `${py}-${pad(pm)}`
  const prevFrom = `${prevPeriod}-01`
  const prevTo = `${prevPeriod}-${new Date(py, pm, 0).getDate()}`
  const today = new Date(y, now.getMonth(), now.getDate())
  const daysSince = (d) => Math.floor((today - new Date(d)) / 86400000)

  try {
    const [monthTx, unpaidSales, labor, unpaidLabor, unissued, projects, quotes, filings] = await Promise.all([
      supabase.from('transactions').select('type, supply_amount, vat, total_amount')
        .gte('transaction_date', monthFrom).lte('transaction_date', monthTo),
      supabase.from('transactions').select('total_amount, transaction_date')
        .eq('type', '매출').eq('payment_status', '미수금'),
      supabase.from('transactions').select('supply_amount, item, crew(name)')
        .eq('type', '외주인건비').gte('transaction_date', prevFrom).lte('transaction_date', prevTo),
      supabase.from('transactions').select('supply_amount, withholding_tax')
        .eq('type', '외주인건비').eq('payment_status', '미지급'),
      supabase.from('transactions').select('id')
        .eq('type', '매출').eq('invoice_issued', false),
      supabase.from('projects').select('name, end_date').eq('status', '진행중'),
      supabase.from('quotes').select('final_amount').eq('status', '발송완료'),
      supabase.from('tax_filings').select('*').eq('period', prevPeriod).maybeSingle(),
    ])
    const firstErr = [monthTx, unpaidSales, labor, unpaidLabor, unissued, projects, quotes]
      .find(r => r.error)
    if (firstErr) return res.status(500).json({ error: firstErr.error.message })

    const txs = monthTx.data || []
    const sumBy = (type) => txs.filter(t => t.type === type)
      .reduce((s, t) => s + Number(t.total_amount ?? (Number(t.supply_amount) + Number(t.vat))), 0)
    const sales = sumBy('매출')
    const purchase = sumBy('매입')
    const laborCost = txs.filter(t => t.type === '외주인건비')
      .reduce((s, t) => s + Number(t.supply_amount || 0), 0)

    const unpaidList = unpaidSales.data || []
    const over90 = unpaidList.filter(t => daysSince(t.transaction_date) >= 90)
    const over30 = unpaidList.filter(t => daysSince(t.transaction_date) >= 30)

    // 원천세: 전월 지급분 집계 + 신고 진행 상태
    const laborRows = labor.data || []
    const people = new Set(laborRows.map(t => t.crew?.name || (t.item || '').split(' (')[0].trim()))
    const incomeTax = laborRows.reduce((s, t) => s + calcIncomeTax(t.supply_amount), 0)
    const localTax = laborRows.reduce((s, t) => s + calcLocalTax(t.supply_amount), 0)
    const f = filings.data || {}
    const steps = ['step_withholding', 'step_statement', 'step_local', 'step_paid']
    const doneCount = steps.filter(k => f[k]).length
    const deadline = new Date(y, now.getMonth(), 10)
    const taxDaysLeft = Math.ceil((deadline - today) / 86400000)

    const overdueProjects = (projects.data || []).filter(p => p.end_date && daysSince(p.end_date) > 0)
    const soonProjects = (projects.data || []).filter(p => p.end_date && daysSince(p.end_date) <= 0 && daysSince(p.end_date) >= -7)
    const unpaidLaborNet = (unpaidLabor.data || [])
      .reduce((s, t) => s + Number(t.supply_amount) - Number(t.withholding_tax || 0), 0)

    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({
      updated_at: now.toISOString(),
      month: { year: y, month: m, sales, purchase, labor: laborCost, profit: sales - purchase - laborCost },
      alerts: {
        receivable: {
          count90: over90.length,
          amount90: over90.reduce((s, t) => s + Number(t.total_amount), 0),
          count30: over30.length,
          total: unpaidList.length,
          totalAmount: unpaidList.reduce((s, t) => s + Number(t.total_amount), 0),
        },
        tax: laborRows.length > 0 && doneCount < 4
          ? { period: prevPeriod, people: people.size, incomeTax, localTax, doneCount, daysLeft: taxDaysLeft }
          : null,
        unpaidLabor: { count: (unpaidLabor.data || []).length, amount: unpaidLaborNet },
        unissuedInvoices: (unissued.data || []).length,
        projects: { overdue: overdueProjects.length, soon: soonProjects.length },
        sentQuotes: {
          count: (quotes.data || []).length,
          amount: (quotes.data || []).reduce((s, q) => s + Number(q.final_amount || 0), 0),
        },
      },
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
