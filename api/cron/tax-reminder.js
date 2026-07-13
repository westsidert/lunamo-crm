import { createClient } from '@supabase/supabase-js'

// 원천세 신고 리마인더 (매월 6일/9일 KST 09:00)
// 전월 외주인건비 지급이 있고 신고 4단계가 미완료면 요약 메일 발송
const truncate10 = (n) => Math.floor((Number(n) || 0) / 10) * 10
const calcIncomeTax = (amount) => truncate10((Number(amount) || 0) * 0.03)
const calcLocalTax = (amount) => truncate10(calcIncomeTax(amount) * 0.1)

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
  const period = `${year}-${pad(month)}`
  const from  = `${period}-01`
  const to    = `${period}-${new Date(year, month, 0).getDate()}`

  // 전월 외주인건비 조회
  const { data: txs, error } = await supabase
    .from('transactions')
    .select('supply_amount, item, crew_id, crew(name)')
    .eq('type', '외주인건비')
    .gte('transaction_date', from)
    .lte('transaction_date', to)
  if (error) return res.status(500).json({ error: error.message })

  if (!txs || txs.length === 0) {
    return res.status(200).json({ skip: true, reason: 'no labor payments', period })
  }

  // 신고 진행 상태 확인
  const { data: filing } = await supabase
    .from('tax_filings').select('*').eq('period', period).maybeSingle()
  const steps = [
    ['홈택스 원천세 신고', filing?.step_withholding],
    ['간이지급명세서 제출', filing?.step_statement],
    ['위택스 지방소득세 신고', filing?.step_local],
    ['납부', filing?.step_paid],
  ]
  const doneCount = steps.filter(([, done]) => done).length
  if (doneCount === 4) {
    return res.status(200).json({ skip: true, reason: 'already filed', period })
  }

  const names = new Set(txs.map(t => t.crew?.name || (t.item || '').split(' (')[0].trim()))
  const amount = txs.reduce((s, t) => s + Number(t.supply_amount || 0), 0)
  const incomeTax = txs.reduce((s, t) => s + calcIncomeTax(t.supply_amount), 0)
  const localTax = txs.reduce((s, t) => s + calcLocalTax(t.supply_amount), 0)

  const today = new Date(now); today.setHours(0, 0, 0, 0)
  const deadline = new Date(now.getFullYear(), now.getMonth(), 10)
  const daysLeft = Math.ceil((deadline - today) / 86400000)
  const dday = daysLeft < 0 ? '마감 경과 - 가산세 주의' : `D-${daysLeft}`

  const fmt = (n) => n.toLocaleString('ko-KR') + '원'
  const appUrl = process.env.APP_URL || ''

  const html = `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><style>
  body { font-family: -apple-system, sans-serif; background: #f8fafc; margin: 0; padding: 32px; }
  .card { background: #fff; border-radius: 16px; padding: 32px; max-width: 520px; margin: 0 auto; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  .title { font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
  .sub { font-size: 13px; color: #94a3b8; margin-bottom: 8px; }
  .dday { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; background: ${daysLeft < 0 ? '#fef2f2' : '#faf5ff'}; color: ${daysLeft < 0 ? '#dc2626' : '#7c3aed'}; margin-bottom: 20px; }
  .row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
  .label { color: #64748b; }
  .value { font-weight: 600; color: #0f172a; }
  .step { padding: 8px 0; font-size: 14px; color: #374151; }
  .btn { display: block; text-align: center; background: #7c3aed; color: #fff; text-decoration: none; padding: 12px; border-radius: 10px; font-size: 14px; font-weight: 600; margin-top: 20px; }
  .footer { font-size: 11px; color: #cbd5e1; text-align: center; margin-top: 24px; }
</style></head>
<body>
  <div class="card">
    <div class="title">🧾 ${year}년 ${month}월 지급분 원천세 신고</div>
    <div class="sub">LUNAMO CRM · 원천세 신고 리마인더 (매월 10일 마감)</div>
    <span class="dday">${dday} · 진행 ${doneCount}/4</span>

    <div class="row"><span class="label">인원</span><span class="value">${names.size}명</span></div>
    <div class="row"><span class="label">총지급금액</span><span class="value">${fmt(amount)}</span></div>
    <div class="row"><span class="label">소득세 (3%)</span><span class="value" style="color:#7c3aed">${fmt(incomeTax)}</span></div>
    <div class="row"><span class="label">지방소득세 (0.3%)</span><span class="value" style="color:#7c3aed">${fmt(localTax)}</span></div>

    <div style="margin-top:20px; font-size:13px; font-weight:700; color:#0f172a;">남은 단계</div>
    ${steps.map(([label, done]) => `<div class="step">${done ? '✅' : '⬜'} ${label}</div>`).join('')}

    ${appUrl ? `<a class="btn" href="${appUrl}">신고 도우미 열기 →</a>` : ''}
    <div class="footer">LUNAMO CRM · 매월 6일·9일 자동 발송 (신고 완료 시 발송 안 함)</div>
  </div>
</body>
</html>`

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'LUNAMO CRM <onboarding@resend.dev>',
      to: [process.env.REPORT_EMAIL],
      subject: `[LUNAMO] ${month}월 지급분 원천세 신고 ${dday} (진행 ${doneCount}/4)`,
      html,
    }),
  })

  if (!emailRes.ok) {
    const err = await emailRes.json()
    return res.status(500).json({ error: err })
  }

  return res.status(200).json({ success: true, period, people: names.size, amount, incomeTax, localTax, doneCount })
}
