export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { to, subject, message, quote } = req.body
  if (!to || !quote) return res.status(400).json({ error: '필수 값 누락' })

  const fmt = (n) => Number(n).toLocaleString('ko-KR')

  const itemRows = (quote.items || []).map(it => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#374151;">${it.cat}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-weight:500;color:#0f172a;">${it.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:#64748b;">${it.day}일</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:#64748b;">${it.qty}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:right;color:#64748b;">${fmt(it.price)}원</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;color:#0f172a;">${fmt(it.day * it.qty * it.price)}원</td>
    </tr>`).join('')

  const html = `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8">
<style>
  body{font-family:-apple-system,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;background:#f8fafc;margin:0;padding:32px;}
  .wrap{max-width:680px;margin:0 auto;}
  .msg{background:#fff;border-radius:12px;padding:28px 32px;margin-bottom:16px;border:1px solid #e2e8f0;font-size:14px;color:#374151;line-height:1.7;white-space:pre-line;}
  .card{background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;}
  .card-header{background:#0f172a;padding:20px 28px;}
  .card-header h2{margin:0;color:#fff;font-size:18px;font-weight:700;}
  .card-header p{margin:4px 0 0;color:#94a3b8;font-size:13px;}
  table{width:100%;border-collapse:collapse;}
  th{padding:10px 12px;background:#f8fafc;font-size:11px;font-weight:600;color:#94a3b8;text-align:left;border-bottom:2px solid #e2e8f0;}
  .total-row td{padding:14px 12px;font-weight:700;font-size:15px;}
  .footer{text-align:center;font-size:11px;color:#cbd5e1;margin-top:20px;}
</style>
</head>
<body>
<div class="wrap">
  <div class="msg">${message || ''}</div>
  <div class="card">
    <div class="card-header">
      <h2>견적서</h2>
      <p>${quote.project_title} · ${quote.client_name} · ${quote.quote_date}</p>
    </div>
    <table>
      <thead>
        <tr>
          <th>구분</th><th>항목</th><th>일수</th><th>수량</th><th>단가</th><th>금액</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
        <tr class="total-row" style="border-top:2px solid #e2e8f0;background:#f8fafc;">
          <td colspan="5" style="text-align:right;color:#64748b;">공급가액</td>
          <td style="text-align:right;color:#0f172a;">${fmt(quote.sub_total)}원</td>
        </tr>
        <tr class="total-row" style="background:#f8fafc;">
          <td colspan="5" style="text-align:right;color:#64748b;">부가세 (10%)</td>
          <td style="text-align:right;color:#0f172a;">${fmt(Math.round(quote.sub_total * 0.1))}원</td>
        </tr>
        <tr class="total-row" style="background:#eff6ff;">
          <td colspan="5" style="text-align:right;color:#2563eb;font-size:16px;">최종 견적금액</td>
          <td style="text-align:right;color:#2563eb;font-size:16px;">${fmt(quote.final_amount)}원</td>
        </tr>
      </tbody>
    </table>
    <div style="padding:16px 24px;background:#f8fafc;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0;">
      루나모 · 사업자등록번호 227-07-55638 · 부산광역시 해운대구 센텀서로 39, 영상산업센터 503호<br/>
      국민은행 125037-04-006309
    </div>
  </div>
  <div class="footer">본 견적서는 LUNAMO CRM에서 자동 발송되었습니다.</div>
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
      from: 'LUNAMO <onboarding@resend.dev>',
      to: [to],
      reply_to: process.env.REPLY_TO_EMAIL,
      subject: subject || `[LUNAMO] 견적서 - ${quote.project_title}`,
      html,
    }),
  })

  if (!emailRes.ok) {
    const err = await emailRes.json().catch(() => ({}))
    return res.status(500).json({ error: err?.message || '전송 실패' })
  }

  return res.status(200).json({ success: true })
}
