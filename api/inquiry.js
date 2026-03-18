import { createClient } from '@supabase/supabase-js'
import { waitUntil } from '@vercel/functions'

// 사용 가능한 견적 항목
const ALL_ITEMS = [
  { cat: 'Pre-production', sub: '기획',   name: '기획료',       price: 300000 },
  { cat: 'Pre-production', sub: '기획',   name: '시나리오',     price: 300000 },
  { cat: 'Pre-production', sub: '기획',   name: '콘티',         price: 300000 },
  { cat: 'Pre-production', sub: '기획',   name: '진행비',       price: 100000 },
  { cat: 'production',     sub: '인건비', name: 'PD',           price: 500000 },
  { cat: 'production',     sub: '인건비', name: '감독',         price: 600000 },
  { cat: 'production',     sub: '인건비', name: '촬영감독',     price: 500000 },
  { cat: 'production',     sub: '인건비', name: '촬영부',       price: 450000 },
  { cat: 'production',     sub: '인건비', name: '그립',         price: 400000 },
  { cat: 'production',     sub: '인건비', name: '조명감독',     price: 600000 },
  { cat: 'production',     sub: '인건비', name: '조명부',       price: 300000 },
  { cat: 'production',     sub: '인건비', name: '미술감독',     price: 500000 },
  { cat: 'production',     sub: '인건비', name: '사운드감독',   price: 500000 },
  { cat: 'production',     sub: '인건비', name: '모델',         price: 300000 },
  { cat: 'production',     sub: '장비',   name: '카메라',       price: 300000 },
  { cat: 'production',     sub: '장비',   name: '렌즈',         price: 200000 },
  { cat: 'production',     sub: '장비',   name: '조명장비',     price: 300000 },
  { cat: 'production',     sub: '장비',   name: '그립장비',     price: 200000 },
  { cat: 'production',     sub: '진행비', name: '차량대여',     price: 200000 },
  { cat: 'production',     sub: '진행비', name: '식대 및 기타', price: 200000 },
  { cat: 'production',     sub: '미술',   name: '장소대여',     price: 200000 },
  { cat: 'Post-production',sub: '편집',   name: '편집',         price: 400000 },
  { cat: 'Post-production',sub: '편집',   name: 'CG',           price: 450000 },
  { cat: 'Post-production',sub: '편집',   name: '2D 그래픽',    price: 400000 },
  { cat: 'Post-production',sub: '편집',   name: '자막',         price: 250000 },
  { cat: 'Post-production',sub: '편집',   name: '색보정',       price: 300000 },
  { cat: 'Post-production',sub: '믹싱',   name: '음악',         price: 300000 },
]

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const body = req.body || {}

  if (Object.keys(body).length === 0) {
    return res.status(400).json({ error: '필수 필드 누락' })
  }

  // 즉시 200 응답 — waitUntil로 백그라운드 처리 보장
  res.status(200).json({ received: true })
  waitUntil(processInquiry(body).catch(e => console.error('[inquiry] 처리 실패:', e)))
}

async function processInquiry(body) {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  // 모든 key를 소문자+공백제거로 정규화해서 검색
  const flatBody = {}
  const normalize = (s) => String(s).toLowerCase().replace(/[\s_\-]/g, '')
  for (const [k, v] of Object.entries(body)) {
    flatBody[normalize(k)] = v
  }

  const get = (...keys) => {
    for (const k of keys) {
      const nk = normalize(k)
      if (flatBody[nk]) return String(flatBody[nk]).trim()
    }
    return ''
  }

  const field   = get('문의분야', 'inquirytype', 'category', 'type')
  const company = get('업체명', 'companyname', 'company', 'organization')
  const contact = get('담당자성함', '담당자', 'contactname', 'name', 'fullname')
  const phone   = get('연락처', 'phone', 'tel', 'mobile')
  const email   = get('이메일', 'email', 'mail')
  const content = get('문의내용', 'message', 'inquiry', 'content', 'description', 'text')
  const refLink = get('레퍼런스영상링크', 'reference', 'referencelink', 'url', 'link')
  const fileUrl = get('첨부파일', 'attachment', 'file', 'fileurl')

  // 매핑 실패 시 body 전체를 문자열로 변환해서 AI에 넘김
  const rawDump = JSON.stringify(body, null, 2)

  // 1. AI로 견적 항목 분석
  const itemsDesc = ALL_ITEMS
    .map(it => `[${it.cat}/${it.sub}] ${it.name} — 기본단가 ${it.price.toLocaleString()}원`)
    .join('\n')

  const userMsg = (field || company || contact || content)
    ? [
        `문의분야: ${field || '미지정'}`,
        `업체명: ${company || '미지정'}`,
        `담당자: ${contact || '미지정'}`,
        `문의내용: ${content || '없음'}`,
        refLink ? `레퍼런스: ${refLink}` : '',
      ].filter(Boolean).join('\n')
    : `폼 데이터 원문:\n${rawDump}`

  const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      system: `당신은 루나모 영상 프로덕션의 견적 AI입니다.
고객 문의 내용을 분석하여 적합한 견적 항목을 추천합니다.
루나모는 부산 기반 영상 제작사로 기업홍보, 다큐, 광고, SNS 콘텐츠 등을 제작합니다.

## 사용 가능한 항목
${itemsDesc}

## 응답 규칙
- 반드시 JSON만 응답 (코드블록·설명 없음)
- 실제로 필요한 항목만 포함
- day·qty는 양의 정수, price는 숫자
- project_title: 프로젝트 제목 (업체명 + 영상 유형)

## 응답 형식
{"project_title":"업체명 기업홍보영상","items":[{"cat":"Pre-production","sub":"기획","name":"기획료","day":2,"qty":1,"price":300000}],"note":"산정 근거"}`,
      messages: [{ role: 'user', content: `다음 의뢰를 분석하여 가견적을 산출해주세요:\n\n${userMsg}` }],
    }),
  })

  let aiData = { project_title: `${company || '신규'} 영상 제작`, items: [], note: '' }
  if (aiRes.ok) {
    const aiJson = await aiRes.json()
    const text = aiJson.content?.[0]?.text || ''
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      try { aiData = JSON.parse(match[0]) } catch (_) {}
    }
  }

  // 2. 거래처 upsert (업체명으로 조회, 없으면 생성)
  let clientId = null
  if (company) {
    const { data: existing } = await supabase
      .from('clients')
      .select('id')
      .ilike('name', company)
      .maybeSingle()

    if (existing) {
      clientId = existing.id
    } else {
      const { data: newClient } = await supabase
        .from('clients')
        .insert({ name: company, contact_person: contact, phone, email })
        .select('id')
        .single()
      clientId = newClient?.id || null
    }
  }

  // 3. 견적서 초안 저장 (items를 quote_items 테이블 형식으로 변환)
  const today = new Date().toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
  }).replace(/\. /g, '-').replace('.', '')

  // quotes 테이블에 존재하는 컬럼만 사용
  const quotePayload = {
    project_title: aiData.project_title || `${company || '신규'} 영상 제작`,
    quote_date: today,
  }
  if (clientId) quotePayload.client_id = clientId
  if (!clientId && company) quotePayload.client_name_override = company

  // 금액 계산
  const subTotal = (aiData.items || []).reduce((s, it) => s + ((it.day||1) * (it.qty||1) * (it.price||0)), 0)
  quotePayload.sub_total = subTotal
  quotePayload.total_with_vat = Math.round(subTotal * 1.1)
  quotePayload.final_amount = Math.round(subTotal * 1.1)
  quotePayload.status = '작성중'

  console.log('[inquiry] quote insert payload:', JSON.stringify(quotePayload))

  const { data: quote, error: qErr } = await supabase
    .from('quotes')
    .insert(quotePayload)
    .select()
    .single()

  if (qErr) {
    console.error('[inquiry] quote insert 실패:', qErr)
    throw new Error(qErr.message)
  }
  console.log('[inquiry] quote 저장 완료:', quote.id)

  // quote_items 저장
  if (aiData.items?.length > 0) {
    const quoteItems = aiData.items.map((it, i) => ({
      quote_id: quote.id,
      sort_order: i,
      category: it.cat,
      sub_category: it.sub || '',
      contents: it.name,
      day: it.day || 1,
      qty: it.qty || 1,
      each_price: it.price || 0,
    }))
    const { error: iErr } = await supabase.from('quote_items').insert(quoteItems)
    if (iErr) console.error('[inquiry] quote_items insert 실패:', iErr)
    else console.log('[inquiry] quote_items 저장 완료:', quoteItems.length, '건')
  }

  // 4. 알림 이메일 발송
  const fmt = (n) => Number(n).toLocaleString('ko-KR')

  const itemRows = (aiData.items || []).map(it => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;color:#374151;">${it.cat}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-weight:500;">${it.name}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:center;">${it.day}일</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:center;">${it.qty}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:right;">${fmt(it.price)}원</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;">${fmt(it.day * it.qty * it.price)}원</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8">
<style>
  body{font-family:-apple-system,'Noto Sans KR',sans-serif;background:#f8fafc;margin:0;padding:24px;}
  .card{background:#fff;border-radius:12px;max-width:680px;margin:0 auto;overflow:hidden;border:1px solid #e2e8f0;}
  .header{background:#0f172a;padding:20px 24px;}
  .header h2{margin:0;color:#fff;font-size:17px;}
  .header p{margin:4px 0 0;color:#94a3b8;font-size:13px;}
  .body{padding:24px;}
  .info{background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:20px;font-size:13px;line-height:1.8;}
  .info strong{color:#0f172a;}
  table{width:100%;border-collapse:collapse;font-size:13px;}
  th{padding:8px 10px;background:#f8fafc;font-size:11px;font-weight:600;color:#94a3b8;text-align:left;border-bottom:2px solid #e2e8f0;}
  .total{padding:12px 10px;font-weight:700;text-align:right;color:#2563eb;font-size:15px;border-top:2px solid #e2e8f0;}
  .note{margin-top:16px;padding:12px 16px;background:#eff6ff;border-radius:8px;font-size:12px;color:#3b82f6;}
  .cta{margin-top:20px;text-align:center;}
  .cta a{display:inline-block;padding:10px 24px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;}
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <h2>📬 새 의뢰가 접수되었습니다</h2>
    <p>AI가 자동으로 가견적을 생성했습니다 · LUNAMO CRM</p>
  </div>
  <div class="body">
    <div class="info">
      <strong>업체명:</strong> ${company || '미지정'}<br>
      <strong>담당자:</strong> ${contact || '미지정'} / ${phone || '-'}<br>
      <strong>이메일:</strong> ${email || '-'}<br>
      <strong>문의분야:</strong> ${field || '미지정'}<br>
      ${refLink ? `<strong>레퍼런스:</strong> <a href="${refLink}">${refLink}</a><br>` : ''}
      <strong>문의내용:</strong><br>
      <span style="color:#374151;white-space:pre-line;">${content || '없음'}</span>
    </div>

    <p style="font-size:13px;font-weight:600;color:#0f172a;margin-bottom:12px;">📊 AI 가견적 — ${aiData.project_title}</p>
    <table>
      <thead>
        <tr><th>구분</th><th>항목</th><th>일수</th><th>수량</th><th>단가</th><th>금액</th></tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    <div class="total">공급가액: ${fmt(subTotal)}원 → 부가세 포함 ${fmt(Math.round(subTotal * 1.1))}원</div>

    ${aiData.note ? `<div class="note">💡 ${aiData.note}</div>` : ''}

    <div class="cta">
      <a href="${process.env.VITE_APP_URL || 'https://lunamo-crm.vercel.app'}">CRM에서 견적서 수정하기 →</a>
    </div>
  </div>
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
      subject: `[LUNAMO] 새 의뢰 — ${company || '신규'} (${field || '문의'})`,
      html,
    }),
  })

  if (!emailRes.ok) {
    const err = await emailRes.json().catch(() => ({}))
    console.error('이메일 발송 실패:', err)
    // 이메일 실패해도 견적 저장은 성공으로 처리
  }

}
