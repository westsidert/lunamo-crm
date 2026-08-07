import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  // Vercel cron 인증 확인
  const authHeader = req.headers['authorization']
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  // 오늘 날짜 (KST 기준)
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const today = now.getDate()
  const dateStr = now.toISOString().slice(0, 10)
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const label = `${year}년 ${month}월`

  // USD 고정비 중 오늘이 결제일이고 활성인 항목 조회
  const firstOfMonth = `${year}-${String(month).padStart(2, '0')}-01`
  const lastOfMonth = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`

  const { data: expenses, error: fetchError } = await supabase
    .from('fixed_expenses')
    .select('*')
    .not('usd_amount', 'is', null)
    .eq('billing_day', today)
    .eq('is_active', true)
    .lte('start_date', lastOfMonth)

  if (fetchError) {
    console.error('fixed_expenses 조회 실패:', fetchError)
    return res.status(500).json({ error: fetchError.message })
  }

  // 결제 주기 판정: 연간/분기 결제는 해당 결제월에만 1회 생성 (분할 없음)
  // 기준월 = billing_month, 없으면 start_date의 월
  const isCycleDue = (fe) => {
    const cycle = fe.billing_cycle || '월간'
    if (cycle === '월간') return true
    const anchor = fe.billing_month || (fe.start_date ? Number(fe.start_date.slice(5, 7)) : 1)
    if (cycle === '연간') return month === anchor
    if (cycle === '분기') return ((month - anchor) % 3 + 3) % 3 === 0
    return true
  }

  // 종료일 + 결제 주기 필터
  const dueExpenses = (expenses || []).filter(fe =>
    (!fe.end_date || fe.end_date >= firstOfMonth) && isCycleDue(fe)
  )

  if (dueExpenses.length === 0) {
    return res.status(200).json({ message: '오늘 결제일인 USD 항목 없음', date: dateStr })
  }

  // 실시간 환율 조회
  let rate
  try {
    const rateRes = await fetch('https://open.er-api.com/v6/latest/USD')
    const rateData = await rateRes.json()
    rate = Math.round(rateData.rates.KRW)
  } catch (e) {
    console.error('환율 조회 실패:', e)
    return res.status(500).json({ error: '환율 조회 실패' })
  }

  // 각 항목마다 거래 내역 자동 생성
  const results = []
  for (const fe of dueExpenses) {
    // 중복 방지: 이번 달에 이미 자동 생성된 동일 항목이 있으면 skip (cron 재실행 대비)
    const { data: dup } = await supabase
      .from('transactions')
      .select('id')
      .eq('item', fe.name)
      .like('memo', '[자동]%')
      .gte('transaction_date', firstOfMonth)
      .lte('transaction_date', lastOfMonth)
      .limit(1)
    if (dup?.length) {
      results.push({ name: fe.name, success: true, skipped: '이번 달 이미 생성됨' })
      continue
    }

    const total = Math.round(fe.usd_amount * rate)
    const supply = Math.round(total / 1.1)
    const vat = total - supply
    const cycleLabel = fe.billing_cycle === '연간' ? `${year}년 연간 결제`
      : fe.billing_cycle === '분기' ? `${label} 분기 결제`
      : label

    const { data, error } = await supabase.from('transactions').insert({
      type: '매입',
      item: fe.name,
      memo: `[자동] ${fe.name} ${cycleLabel} (USD $${fe.usd_amount} × ${rate.toLocaleString()}원)`,
      transaction_date: dateStr,
      supply_amount: supply,
      vat,
      payment_status: '지급완료',
      client_id: null,
      project_id: null,
    }).select().single()

    if (error) {
      console.error(`${fe.name} 저장 실패:`, error)
      results.push({ name: fe.name, success: false, error: error.message })
    } else {
      results.push({ name: fe.name, success: true, usd: fe.usd_amount, rate, krw: total })
    }
  }

  return res.status(200).json({ date: dateStr, rate, results })
}
