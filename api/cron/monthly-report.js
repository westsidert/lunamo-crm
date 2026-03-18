import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  // 전월 계산 (KST 기준)
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const year  = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const month = now.getMonth() === 0 ? 12 : now.getMonth()
  const pad   = (n) => String(n).padStart(2, '0')
  const from  = `${year}-${pad(month)}-01`
  const to    = `${year}-${pad(month)}-${new Date(year, month, 0).getDate()}`

  // 전월 거래 내역 조회
  const { data: txs, error } = await supabase
    .from('transactions')
    .select('type, supply_amount, vat')
    .gte('transaction_date', from)
    .lte('transaction_date', to)

  if (error) return res.status(500).json({ error: error.message })

  // 고정비 조회
  const { data: fixedList } = await supabase.from('fixed_expenses').select('*').eq('is_active', true)

  const sum = (type) => (txs || [])
    .filter(t => t.type === type)
    .reduce((s, t) => s + Number(t.supply_amount) + Number(t.vat), 0)

  const sales    = sum('매출')
  const purchase = sum('매입')
  const labor    = sum('외주인건비')

  // 고정비 월 환산
  const CYCLE_DIV = { '월간': 1, '분기': 3, '연간': 12 }
  const fixed = (fixedList || []).filter(fe => {
    return fe.start_date <= to && (!fe.end_date || fe.end_date >= from)
  }).reduce((s, fe) => s + Math.round(fe.amount / (CYCLE_DIV[fe.billing_cycle] ?? 1)), 0)

  const profit = sales - purchase - labor - fixed
  const margin = sales ? Math.round(profit / sales * 100) : 0

  const fmt = (n) => n.toLocaleString('ko-KR') + '원'
  const sign = (n) => n >= 0 ? '+' : ''

  const html = `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><style>
  body { font-family: -apple-system, sans-serif; background: #f8fafc; margin: 0; padding: 32px; }
  .card { background: #fff; border-radius: 16px; padding: 32px; max-width: 520px; margin: 0 auto; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  .title { font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
  .sub { font-size: 13px; color: #94a3b8; margin-bottom: 28px; }
  .row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
  .label { color: #64748b; }
  .value { font-weight: 600; color: #0f172a; }
  .profit { font-size: 18px; font-weight: 700; color: ${profit >= 0 ? '#059669' : '#dc2626'}; }
  .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; background: ${profit >= 0 ? '#f0fdf4' : '#fef2f2'}; color: ${profit >= 0 ? '#059669' : '#dc2626'}; margin-left: 8px; }
  .footer { font-size: 11px; color: #cbd5e1; text-align: center; margin-top: 24px; }
</style></head>
<body>
  <div class="card">
    <div class="title">📊 ${year}년 ${month}월 손익 보고서</div>
    <div class="sub">LUNAMO 영상 프로덕션 · 월간 자동 보고서</div>

    <div class="row"><span class="label">매출</span><span class="value" style="color:#2563eb">${fmt(sales)}</span></div>
    <div class="row"><span class="label">매입</span><span class="value" style="color:#d97706">- ${fmt(purchase)}</span></div>
    <div class="row"><span class="label">외주인건비</span><span class="value" style="color:#7c3aed">- ${fmt(labor)}</span></div>
    <div class="row"><span class="label">고정비</span><span class="value" style="color:#0891b2">- ${fmt(fixed)}</span></div>
    <div class="row" style="border-bottom:none; padding-top:16px;">
      <span class="label" style="font-weight:600; color:#0f172a;">순이익</span>
      <span>
        <span class="profit">${sign(profit)}${fmt(profit)}</span>
        <span class="badge">${profit >= 0 ? '흑자' : '적자'} ${margin}%</span>
      </span>
    </div>

    <div class="footer">LUNAMO CRM · 매월 1일 자동 발송</div>
  </div>
</body>
</html>`

  // Resend로 이메일 전송
  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'LUNAMO CRM <onboarding@resend.dev>',
      to: [process.env.REPORT_EMAIL],
      subject: `[LUNAMO] ${year}년 ${month}월 손익 보고서`,
      html,
    }),
  })

  if (!emailRes.ok) {
    const err = await emailRes.json()
    return res.status(500).json({ error: err })
  }

  return res.status(200).json({ success: true, year, month, sales, purchase, labor, fixed, profit })
}
