import { useState, useEffect } from 'react'
import { getQuotes, createQuote, updateQuote, deleteQuote, getClients } from '../lib/api'
import { formatKRW } from '../lib/utils'
import { analyzeQuoteRequest, hasAiKey, getAiKey, setAiKey, getLogo, getStamp, setLogo, setStamp } from '../lib/ai'

// ── 전체 항목 정의 (엑셀 산출 양식 기반) ─────────────────────────────────
const ALL_ITEMS = [
  // Pre-production
  { cat: 'Pre-production', sub: '기획',   name: '기획료',           price: 300000 },
  { cat: 'Pre-production', sub: '기획',   name: '시나리오',         price: 300000 },
  { cat: 'Pre-production', sub: '기획',   name: '콘티',             price: 300000 },
  { cat: 'Pre-production', sub: '기획',   name: '진행비',           price: 100000 },
  // Production - 인건비
  { cat: 'production',     sub: '인건비', name: 'PD',               price: 500000 },
  { cat: 'production',     sub: '인건비', name: '제작부',           price: 300000 },
  { cat: 'production',     sub: '인건비', name: '감독',             price: 600000 },
  { cat: 'production',     sub: '인건비', name: '연출부',           price: 300000 },
  { cat: 'production',     sub: '인건비', name: '촬영감독',         price: 500000 },
  { cat: 'production',     sub: '인건비', name: '촬영부',           price: 450000 },
  { cat: 'production',     sub: '인건비', name: '그립',             price: 400000 },
  { cat: 'production',     sub: '인건비', name: '조명감독',         price: 600000 },
  { cat: 'production',     sub: '인건비', name: '조명부',           price: 300000 },
  { cat: 'production',     sub: '인건비', name: '미술감독',         price: 500000 },
  { cat: 'production',     sub: '인건비', name: '미술팀',           price: 300000 },
  { cat: 'production',     sub: '인건비', name: '사운드감독',       price: 500000 },
  { cat: 'production',     sub: '인건비', name: '사운드팀',         price: 300000 },
  { cat: 'production',     sub: '인건비', name: '의상',             price: 400000 },
  { cat: 'production',     sub: '인건비', name: '분장',             price: 600000 },
  { cat: 'production',     sub: '인건비', name: '모델',             price: 300000 },
  { cat: 'production',     sub: '인건비', name: '보조출연',         price: 100000 },
  { cat: 'production',     sub: '인건비', name: '지원',             price: 200000 },
  // Production - 장비
  { cat: 'production',     sub: '장비',   name: '카메라',           price: 0 },
  { cat: 'production',     sub: '장비',   name: '렌즈',             price: 0 },
  { cat: 'production',     sub: '장비',   name: '그립장비',         price: 0 },
  { cat: 'production',     sub: '장비',   name: '크레인',           price: 0 },
  { cat: 'production',     sub: '장비',   name: '조명장비',         price: 0 },
  { cat: 'production',     sub: '장비',   name: '녹음기',           price: 0 },
  { cat: 'production',     sub: '장비',   name: '장비 기타',        price: 0 },
  // Production - 미술
  { cat: 'production',     sub: '미술',   name: '소품제작',         price: 0 },
  { cat: 'production',     sub: '미술',   name: '소품대여',         price: 0 },
  { cat: 'production',     sub: '미술',   name: '세트대여',         price: 0 },
  { cat: 'production',     sub: '미술',   name: '장소대여',         price: 200000 },
  { cat: 'production',     sub: '미술',   name: '미술 기타',        price: 0 },
  // Production - 진행비
  { cat: 'production',     sub: '진행비', name: '차량대여',         price: 200000 },
  { cat: 'production',     sub: '진행비', name: '식대 및 기타',     price: 200000 },
  { cat: 'production',     sub: '진행비', name: '출장비',           price: 0 },
  // Post-production - 편집
  { cat: 'Post-production',sub: '편집',   name: '편집',             price: 400000 },
  { cat: 'Post-production',sub: '편집',   name: 'CG',               price: 450000 },
  { cat: 'Post-production',sub: '편집',   name: '2D 그래픽',        price: 400000 },
  { cat: 'Post-production',sub: '편집',   name: '3D 그래픽',        price: 600000 },
  { cat: 'Post-production',sub: '편집',   name: '자막',             price: 250000 },
  { cat: 'Post-production',sub: '편집',   name: '색보정',           price: 300000 },
  // Post-production - 믹싱
  { cat: 'Post-production',sub: '믹싱',   name: '녹음료',           price: 300000 },
  { cat: 'Post-production',sub: '믹싱',   name: '음악',             price: 300000 },
  { cat: 'Post-production',sub: '믹싱',   name: '폴리',             price: 300000 },
  { cat: 'Post-production',sub: '믹싱',   name: '성우료',           price: 300000 },
  { cat: 'Post-production',sub: '믹싱',   name: '번역 및 감수',     price: 200000 },
  // 기타
  { cat: '기타',            sub: '기타',   name: '유튜브 광고',     price: 1000000 },
  { cat: '기타',            sub: '기타',   name: '댓글이벤트',      price: 700000 },
  { cat: '기타',            sub: '기타',   name: '채널 운영 관리',  price: 1500000 },
]

const itemKey = (item) => `${item.cat}|${item.sub}|${item.name}`

const initValues = () => {
  const v = {}
  ALL_ITEMS.forEach(item => {
    v[itemKey(item)] = { day: '', qty: '', price: item.price, nameOverride: '' }
  })
  return v
}

const calcItemSum = (v) => {
  const day = Number(v.day) || 0
  const qty = Number(v.qty) || 0
  const price = Number(v.price) || 0
  if (day === 0 && qty === 0) return 0
  return price * (day || 1) * (qty || 1)
}

const calcTotals = (values, customItems, discountRate, isFirstDeal) => {
  const regularSum = ALL_ITEMS.reduce((s, item) => s + calcItemSum(values[itemKey(item)] || {}), 0)
  const customSum  = (customItems || []).reduce((s, ci) => s + calcItemSum(ci), 0)
  const subTotal   = regularSum + customSum
  const totalWithVat = Math.round(subTotal * 1.1)
  const roundDown = Math.floor(totalWithVat / 10000) * 10000
  const finalAmount = isFirstDeal
    ? Math.floor((roundDown * (1 - (Number(discountRate) || 0) / 100)) / 10000) * 10000
    : roundDown
  return { subTotal, totalWithVat, roundDown, finalAmount }
}

// DB items → { values, customItems } 복원
const parseDbItems = (dbItems) => {
  const values = initValues()
  const customItems = []
  dbItems.forEach(item => {
    let match = null
    if (item.preset_key) {
      match = ALL_ITEMS.find(a => itemKey(a) === item.preset_key)
    }
    if (!match) {
      match = ALL_ITEMS.find(a => a.name === item.contents && a.cat === item.category)
    }
    if (match) {
      const override = item.contents && item.contents !== match.name ? item.contents : ''
      values[itemKey(match)] = { day: item.day, qty: item.qty, price: item.each_price, nameOverride: override }
    } else {
      customItems.push({ _id: Math.random(), cat: item.category || '기타', name: item.contents, day: item.day, qty: item.qty, price: item.each_price })
    }
  })
  return { values, customItems }
}

const PROVIDER = {
  name: '루나모', bizno: '227-07-55638',
  address: '부산광역시 해운대구 센텀서로 39,\n영상산업센터 503호',
  rep: '황수연', bank: '국민은행 125037-04-006309',
}

const STATUS_STYLE = {
  '작성중':  { bg: '#f1f5f9', color: '#475569' },
  '발송완료': { bg: '#eff6ff', color: '#2563eb' },
  '수주':    { bg: '#f0fdf4', color: '#16a34a' },
  '미수주':  { bg: '#fef2f2', color: '#dc2626' },
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function Quotes() {
  const [quotes, setQuotes]   = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)   // null | { meta, values, discount, id? }
  const [preview, setPreview] = useState(null)
  const [showImgSettings, setShowImgSettings] = useState(false)

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [q, c] = await Promise.all([getQuotes(), getClients()])
      setQuotes(q); setClients(c)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const openCreate = () => setEditing({
    initialStep: 0,
    meta: { quote_date: new Date().toISOString().slice(0, 10), client_id: '', client_name_override: '', project_title: '', status: '작성중', memo: '' },
    values: initValues(),
    customItems: [],
    discount: { is_first_deal: false, discount_rate: 15 },
  })

  const openEdit = (q) => {
    const sorted = (q.quote_items || []).sort((a, b) => a.sort_order - b.sort_order)
    const { values, customItems } = parseDbItems(sorted)
    setEditing({
      initialStep: 1,
      id: q.id,
      meta: { quote_date: q.quote_date, client_id: q.client_id || '', client_name_override: q.client_name_override || '', project_title: q.project_title, status: q.status, memo: q.memo || '' },
      values, customItems,
      discount: { is_first_deal: q.is_first_deal, discount_rate: q.discount_rate },
    })
  }

  const openPreview = (q) => setPreview({
    ...q,
    items: (q.quote_items || []).sort((a, b) => a.sort_order - b.sort_order),
  })

  const handleSave = async ({ meta, values, customItems, discount, id }) => {
    const regularSelected = ALL_ITEMS
      .filter(item => calcItemSum(values[itemKey(item)] || {}) > 0)
      .map(item => {
        const v = values[itemKey(item)]
        return { category: item.cat, contents: (v.nameOverride && v.nameOverride.trim()) ? v.nameOverride.trim() : item.name, preset_key: itemKey(item), each_price: Number(v.price)||0, qty: Number(v.qty)||1, day: Number(v.day)||1, sum: calcItemSum(v) }
      })
    const customSelected = (customItems || [])
      .filter(ci => calcItemSum(ci) > 0)
      .map(ci => ({ category: ci.cat, contents: ci.name, preset_key: null, each_price: Number(ci.price)||0, qty: Number(ci.qty)||1, day: Number(ci.day)||1, sum: calcItemSum(ci) }))
    const selectedItems = [...regularSelected, ...customSelected].map((item, i) => ({ ...item, sort_order: i }))
    const { subTotal, totalWithVat, finalAmount } = calcTotals(values, customItems, discount.discount_rate, discount.is_first_deal)
    const payload = {
      ...meta,
      client_id: meta.client_id || null,
      memo: meta.memo || null,
      sub_total: subTotal, total_with_vat: totalWithVat, final_amount: finalAmount,
      is_first_deal: discount.is_first_deal, discount_rate: discount.discount_rate,
    }
    if (id) await updateQuote(id, { ...payload, items: selectedItems })
    else    await createQuote({ ...payload, items: selectedItems })
    await loadAll()
    setEditing(null)
  }

  const handleDelete = async (id) => {
    if (!confirm('견적서를 삭제하시겠습니까?')) return
    await deleteQuote(id)
    setQuotes(prev => prev.filter(q => q.id !== id))
  }

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>견적서</h1>
          <p style={{ color: '#64748b', marginTop: 4, fontSize: 13 }}>견적서 작성 · 관리 · PDF 출력</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowImgSettings(true)} style={{ ...btnPrimary, background: '#64748b' }}>🖼 로고/도장</button>
          <button onClick={openCreate} style={btnPrimary}>+ 견적서 작성</button>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              {['날짜', '거래처', '프로젝트명', '최종 금액', '상태', ''].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 12, color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>불러오는 중...</td></tr>
            ) : quotes.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>견적서가 없습니다</td></tr>
            ) : quotes.map(q => {
              const ss = STATUS_STYLE[q.status] || STATUS_STYLE['작성중']
              const clientName = q.clients?.name || q.client_name_override || '-'
              return (
                <tr key={q.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={tdStyle}>{new Date(q.quote_date).toLocaleDateString('ko-KR')}</td>
                  <td style={tdStyle}>{clientName}</td>
                  <td style={{ ...tdStyle, maxWidth: 280 }}>{q.project_title}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                    {formatKRW(q.final_amount)}원
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: ss.bg, color: ss.color }}>
                      {q.status}
                    </span>
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => openPreview(q)} style={btnSmall}>미리보기</button>
                      <button onClick={() => openEdit(q)} style={btnSmall}>수정</button>
                      <button onClick={() => handleDelete(q.id)} style={{ ...btnSmall, color: '#ef4444' }}>삭제</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <QuoteWizard
          initial={editing}
          clients={clients}
          pastQuotes={quotes}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
      {preview && (
        <QuotePreviewModal
          quote={preview}
          clients={clients}
          onClose={() => setPreview(null)}
        />
      )}
      {showImgSettings && <ImageSettingsModal onClose={() => setShowImgSettings(false)} />}
    </div>
  )
}

// ── 2단계 위저드 (산출 양식 → 견적서) ─────────────────────────────────────
const CATS_FOR_CUSTOM = ['Pre-production', 'production', 'Post-production', '기타']

function QuoteWizard({ initial, clients, pastQuotes = [], onClose, onSave }) {
  const [step, setStep]             = useState(initial.initialStep ?? 1)
  const [meta, setMeta]             = useState(initial.meta)
  const [values, setValues]         = useState(initial.values)
  const [customItems, setCustomItems] = useState(initial.customItems || [])
  const [discount, setDiscount]     = useState(initial.discount)
  const [saving, setSaving]         = useState(false)
  const [onlyFilled, setOnlyFilled] = useState(false)
  const [showCompModal, setShowCompModal] = useState(false)

  // ── Step 0: AI 분석 상태 ──
  const [aiDesc, setAiDesc]         = useState('')
  const [aiLoading, setAiLoading]   = useState(false)
  const [aiNote, setAiNote]         = useState('')
  const [aiError, setAiError]       = useState('')
  const [aiKeyInput, setAiKeyInput] = useState(getAiKey())
  const [showKeyInput, setShowKeyInput] = useState(!hasAiKey())

  const setMeta_ = (k, v) => setMeta(m => ({ ...m, [k]: v }))
  const setVal   = (key, field, v) => setValues(prev => ({ ...prev, [key]: { ...prev[key], [field]: v } }))

  // 소요일/수량 일괄 ±1 (현재 값이 0보다 큰 행만 대상)
  const bumpField = (field, delta) => {
    setValues(prev => {
      const next = { ...prev }
      Object.keys(next).forEach(k => {
        const cur = Number(next[k][field]) || 0
        if (cur > 0) next[k] = { ...next[k], [field]: String(Math.max(0, cur + delta)) }
      })
      return next
    })
    setCustomItems(prev => prev.map(ci => {
      const cur = Number(ci[field]) || 0
      if (cur > 0) return { ...ci, [field]: String(Math.max(0, cur + delta)) }
      return ci
    }))
  }

  const addCustomItem = () => setCustomItems(prev => [...prev, { _id: Math.random(), cat: 'production', name: '', day: '', qty: '', price: 0 }])
  const updateCI = (id, field, v) => setCustomItems(prev => prev.map(ci => ci._id === id ? { ...ci, [field]: v } : ci))
  const removeCI = (id) => setCustomItems(prev => prev.filter(ci => ci._id !== id))

  const { subTotal, totalWithVat, roundDown, finalAmount } =
    calcTotals(values, customItems, discount.discount_rate, discount.is_first_deal)

  const regularSelected = ALL_ITEMS.filter(item => calcItemSum(values[itemKey(item)] || {}) > 0)
  const customSelected  = customItems.filter(ci => ci.name && calcItemSum(ci) > 0)
  const selectedItems   = [...regularSelected, ...customSelected]

  const handleSave = async () => {
    setSaving(true)
    try { await onSave({ meta, values, customItems, discount, id: initial.id }) }
    catch (e) { alert('저장 실패: ' + e.message) }
    setSaving(false)
  }

  // 그룹 구조: [{cat, subs: [{sub, items: [...]}]}]
  const cats = []
  ALL_ITEMS.forEach(item => {
    if (onlyFilled && calcItemSum(values[itemKey(item)] || {}) === 0) return
    let catObj = cats.find(c => c.cat === item.cat)
    if (!catObj) { catObj = { cat: item.cat, subs: [] }; cats.push(catObj) }
    let subObj = catObj.subs.find(s => s.sub === item.sub)
    if (!subObj) { subObj = { sub: item.sub, items: [] }; catObj.subs.push(subObj) }
    subObj.items.push(item)
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      display: 'flex', flexDirection: 'column', zIndex: 1000 }}>
      {/* 상단 바 */}
      <div style={{ background: '#0f172a', padding: '12px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        {/* 스텝 표시 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {[
            { n: 0, label: 'AI 가견적' },
            { n: 1, label: '산출 양식' },
            { n: 2, label: '견적서 확인 · 저장' },
          ].map(({ n, label }) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: step === n ? '#7c3aed' : step > n ? '#16a34a' : '#334155',
                color: '#fff', fontSize: 12, fontWeight: 700,
              }}>{step > n ? '✓' : n === 0 ? '✦' : n}</div>
              <span style={{ fontSize: 13, color: step === n ? '#f8fafc' : '#94a3b8', fontWeight: step === n ? 600 : 400 }}>
                {label}
              </span>
              {n < 2 && <span style={{ color: '#334155', marginLeft: 4 }}>→</span>}
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: '1px solid #475569', borderRadius: 8, padding: '6px 16px', color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}>
          취소
        </button>
      </div>

      {/* 콘텐츠 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px', background: '#f8fafc' }}>

        {/* ── Step 0: AI 가견적 ── */}
        {step === 0 && (
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '28px 32px', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 22 }}>✦</span>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>AI 가견적 분석</div>
                <span style={{ fontSize: 12, background: '#f3f0ff', color: '#7c3aed', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>Beta</span>
              </div>
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24, lineHeight: 1.7 }}>
                고객의 의뢰 내용 또는 프로젝트 개요를 입력하면 AI가 과거 견적 사례를 참고하여<br />
                산출 양식에 항목을 자동으로 채워드립니다. 이후 직접 수정·확인하실 수 있습니다.
              </p>

              {/* API 키 설정 */}
              {showKeyInput ? (
                <div style={{ background: '#fafafa', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}>
                    🔑 Anthropic API 키 설정
                    <span style={{ fontSize: 12, fontWeight: 400, color: '#94a3b8', marginLeft: 8 }}>
                      <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>console.anthropic.com</a>에서 발급
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="password"
                      value={aiKeyInput}
                      onChange={e => setAiKeyInput(e.target.value)}
                      placeholder="sk-ant-..."
                      style={{ ...inputStyle, fontFamily: 'monospace', flex: 1 }}
                    />
                    <button
                      onClick={() => { setAiKey(aiKeyInput); setShowKeyInput(false) }}
                      disabled={!aiKeyInput.startsWith('sk-ant')}
                      style={{ ...btnPrimary, background: '#7c3aed', whiteSpace: 'nowrap',
                        opacity: !aiKeyInput.startsWith('sk-ant') ? 0.5 : 1 }}>
                      저장
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                  <button onClick={() => setShowKeyInput(true)}
                    style={{ fontSize: 12, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                    API 키 변경
                  </button>
                </div>
              )}

              {/* 의뢰 내용 입력 */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ ...labelStyle, marginBottom: 8 }}>프로젝트 의뢰 내용</label>
                <textarea
                  value={aiDesc}
                  onChange={e => setAiDesc(e.target.value)}
                  placeholder={`예시:\n"부산시 기관 홍보영상 1편 제작. 인터뷰 2~3인 포함, 1일 촬영 예정. 완성본 약 3분, 자막·CG 처리 필요. 납품 기한 3주."\n\n또는 고객에게 받은 의뢰 이메일 내용을 그대로 붙여넣으세요.`}
                  rows={8}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.7, fontFamily: 'inherit' }}
                />
              </div>

              {/* 에러 */}
              {aiError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#dc2626' }}>
                  {aiError}
                </div>
              )}

              {/* AI 분석 결과 노트 */}
              {aiNote && (
                <div style={{ background: '#f3f0ff', border: '1px solid #c4b5fd', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#7c3aed', marginBottom: 4 }}>✦ AI 분석 결과</div>
                  <div style={{ fontSize: 13, color: '#4c1d95', lineHeight: 1.7 }}>{aiNote}</div>
                  <div style={{ fontSize: 12, color: '#7c3aed', marginTop: 8 }}>→ 산출 양식에 항목이 자동 기입되었습니다. 다음 단계에서 확인·수정하세요.</div>
                </div>
              )}

              {/* 버튼 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <button onClick={() => setStep(1)} style={{ ...btnCancel, fontSize: 13 }}>
                  건너뛰기 (직접 입력) →
                </button>
                <button
                  onClick={async () => {
                    if (!aiDesc.trim()) { setAiError('의뢰 내용을 입력해주세요'); return }
                    if (!hasAiKey()) { setAiError('API 키를 먼저 설정해주세요'); return }
                    setAiError(''); setAiLoading(true); setAiNote('')
                    try {
                      const result = await analyzeQuoteRequest(aiDesc, pastQuotes, ALL_ITEMS)
                      // 결과를 values에 반영
                      const newValues = initValues()
                      const newCustom = []
                      result.items.forEach(item => {
                        const match = ALL_ITEMS.find(a => a.name === item.name && a.cat === item.cat)
                        if (match) {
                          newValues[itemKey(match)] = { day: item.day, qty: item.qty, price: item.price ?? match.price }
                        } else {
                          newCustom.push({ _id: Math.random(), cat: item.cat || '기타', name: item.name, day: item.day, qty: item.qty, price: item.price ?? 0 })
                        }
                      })
                      setValues(newValues)
                      setCustomItems(newCustom)
                      setAiNote(result.note || '')
                      setOnlyFilled(true)
                      setStep(1)
                    } catch (e) {
                      setAiError('분석 실패: ' + e.message)
                    }
                    setAiLoading(false)
                  }}
                  disabled={aiLoading || !aiDesc.trim() || showKeyInput}
                  style={{ ...btnPrimary, background: '#7c3aed', display: 'flex', alignItems: 'center', gap: 8,
                    opacity: (aiLoading || !aiDesc.trim() || showKeyInput) ? 0.6 : 1,
                    cursor: (aiLoading || !aiDesc.trim() || showKeyInput) ? 'not-allowed' : 'pointer' }}>
                  {aiLoading ? (
                    <>
                      <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      AI 분석 중...
                    </>
                  ) : '✦ AI 가견적 분석'}
                </button>
              </div>
            </div>

            {/* 과거 참고 데이터 안내 */}
            <div style={{ background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', padding: '14px 20px', fontSize: 12, color: '#64748b', lineHeight: 1.7 }}>
              <b style={{ color: '#475569' }}>참고 데이터:</b> 현재 저장된 견적서 {pastQuotes.length}건을 AI 분석 참고 자료로 자동 활용합니다.
              {pastQuotes.length < 3 && ' 견적서를 더 저장할수록 분석 정확도가 올라갑니다.'}
            </div>
          </div>
        )}

        {/* ── Step 1: 산출 양식 ── */}
        {step === 1 && (
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            {/* 기본 정보 */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '20px 24px', marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>기본 정보</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 0.8fr', gap: 16 }}>
                <div>
                  <label style={labelStyle}>날짜 *</label>
                  <input type="date" value={meta.quote_date} onChange={e => setMeta_('quote_date', e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>거래처</label>
                  <select value={meta.client_id} onChange={e => setMeta_('client_id', e.target.value)} style={inputStyle}>
                    <option value="">직접 입력</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>상태</label>
                  <select value={meta.status} onChange={e => setMeta_('status', e.target.value)} style={inputStyle}>
                    {['작성중', '발송완료', '수주', '미수주'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              {!meta.client_id && (
                <div style={{ marginTop: 12 }}>
                  <label style={labelStyle}>거래처명 (직접 입력)</label>
                  <input value={meta.client_name_override} onChange={e => setMeta_('client_name_override', e.target.value)} placeholder="거래처명" style={inputStyle} />
                </div>
              )}
              <div style={{ marginTop: 12 }}>
                <label style={labelStyle}>프로젝트명 *</label>
                <input value={meta.project_title} onChange={e => setMeta_('project_title', e.target.value)} placeholder="예) 기업 홍보영상 제작" style={inputStyle} required />
              </div>
            </div>

            {/* 산출 양식 테이블 */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 20 }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                  산출 양식
                  <span style={{ fontSize: 12, fontWeight: 400, color: '#94a3b8', marginLeft: 8 }}>
                    소요일 · 수량을 입력하면 자동 계산됩니다
                  </span>
                </span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: '#475569' }}>
                  <input type="checkbox" checked={onlyFilled} onChange={e => setOnlyFilled(e.target.checked)} />
                  입력된 항목만 보기
                </label>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                      <th style={thStyle}>구분</th>
                      <th style={thStyle}>세부</th>
                      <th style={{ ...thStyle, textAlign: 'left' }}>항목</th>
                      <th style={{ ...thStyle, width: 70 }}>
                        <BumpHeader label="소요일" onUp={() => bumpField('day', 1)} onDown={() => bumpField('day', -1)} />
                      </th>
                      <th style={{ ...thStyle, width: 70 }}>
                        <BumpHeader label="수량" onUp={() => bumpField('qty', 1)} onDown={() => bumpField('qty', -1)} />
                      </th>
                      <th style={{ ...thStyle, width: 120 }}>단가</th>
                      <th style={{ ...thStyle, width: 120 }}>소계</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cats.map(({ cat, subs }) => {
                      const catLabel = { 'Pre-production': 'Pre-\nproduction', 'production': 'production', 'Post-production': 'Post-\nproduction', '기타': '기타' }[cat] || cat
                      const catRowCount = subs.reduce((s, sb) => s + sb.items.length, 0)
                      let catRendered = false
                      return subs.map(({ sub, items }) => {
                        const subRowCount = items.length
                        let subRendered = false
                        // 첫 번째 항목명이 sub명과 같으면 rowSpan이 생성되지 않으므로 각 행마다 빈 td 필요
                        const firstItemNameIsSub = items.length > 0 && items[0].name === sub
                        return items.map((item, itemIdx) => {
                          const key = itemKey(item)
                          const v   = values[key] || { day: '', qty: '', price: item.price }
                          const sum = calcItemSum(v)
                          const hasSub = sub !== cat && sub !== item.name
                          const isFilled = sum > 0
                          const showCat = !catRendered
                          const showSub = !subRendered
                          catRendered = true; subRendered = true
                          return (
                            <tr key={key} style={{
                              borderBottom: '1px solid #f1f5f9',
                              background: isFilled ? '#eff6ff' : undefined,
                            }}>
                              {showCat && (
                                <td rowSpan={catRowCount} style={{
                                  padding: '8px 12px', fontSize: 11, fontWeight: 700,
                                  color: '#475569', textAlign: 'center', verticalAlign: 'top',
                                  background: '#f8fafc', borderRight: '1px solid #e2e8f0',
                                  borderBottom: '1px solid #e2e8f0', whiteSpace: 'pre-line',
                                  width: 72,
                                }}>
                                  {catLabel}
                                </td>
                              )}
                              {hasSub && showSub ? (
                                <td rowSpan={subRowCount} style={{
                                  padding: '8px 10px', fontSize: 12, fontWeight: 600,
                                  color: '#64748b', textAlign: 'center', verticalAlign: 'top',
                                  borderRight: '1px solid #f1f5f9', whiteSpace: 'nowrap', width: 60,
                                }}>
                                  {sub}
                                </td>
                              ) : !hasSub || (hasSub && !showSub && firstItemNameIsSub) ? (
                                <td style={{ borderRight: '1px solid #f1f5f9' }} />
                              ) : null}
                              <td style={{ padding: '5px 12px', fontSize: 13, color: isFilled ? '#1e40af' : '#374151', fontWeight: isFilled ? 600 : 400 }}>
                                <EditableName
                                  defaultName={item.name}
                                  override={v.nameOverride || ''}
                                  onChange={val => setVal(key, 'nameOverride', val)}
                                  isFilled={isFilled}
                                />
                              </td>
                              <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                                <input
                                  type="number" min="0" value={v.day}
                                  onChange={e => setVal(key, 'day', e.target.value)}
                                  style={{ ...cellInput, background: isFilled ? '#dbeafe' : '#fff' }}
                                  placeholder="0"
                                />
                              </td>
                              <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                                <input
                                  type="number" min="0" value={v.qty}
                                  onChange={e => setVal(key, 'qty', e.target.value)}
                                  style={{ ...cellInput, background: isFilled ? '#dbeafe' : '#fff' }}
                                  placeholder="0"
                                />
                              </td>
                              <td style={{ padding: '4px 6px' }}>
                                <input
                                  type="number" min="0" value={v.price}
                                  onChange={e => setVal(key, 'price', e.target.value)}
                                  style={{ ...cellInput, textAlign: 'right', background: isFilled ? '#dbeafe' : '#f8fafc' }}
                                />
                              </td>
                              <td style={{ padding: '5px 12px', textAlign: 'right', fontSize: 13,
                                fontWeight: isFilled ? 700 : 400, color: isFilled ? '#1e40af' : '#94a3b8' }}>
                                {isFilled ? formatKRW(sum) : '-'}
                              </td>
                            </tr>
                          )
                        })
                      })
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 커스텀 항목 추가 */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 20 }}>
              <div style={{ padding: '14px 20px', borderBottom: customItems.length ? '1px solid #e2e8f0' : undefined,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                  추가 항목
                  <span style={{ fontSize: 12, fontWeight: 400, color: '#94a3b8', marginLeft: 8 }}>
                    목록에 없는 항목을 직접 추가하세요
                  </span>
                </span>
                <button type="button" onClick={addCustomItem} style={{
                  padding: '6px 14px', borderRadius: 8, border: '1px dashed #94a3b8',
                  background: '#f8fafc', cursor: 'pointer', fontSize: 13, color: '#475569', fontWeight: 500,
                }}>
                  + 항목 추가
                </button>
              </div>
              {customItems.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                    <thead>
                      <tr style={{ background: '#fafafa' }}>
                        <th style={{ ...thStyle, textAlign: 'left', width: 120 }}>구분</th>
                        <th style={{ ...thStyle, textAlign: 'left' }}>항목명</th>
                        <th style={{ ...thStyle, width: 70 }}>
                          <BumpHeader label="소요일" onUp={() => bumpField('day', 1)} onDown={() => bumpField('day', -1)} />
                        </th>
                        <th style={{ ...thStyle, width: 70 }}>
                          <BumpHeader label="수량" onUp={() => bumpField('qty', 1)} onDown={() => bumpField('qty', -1)} />
                        </th>
                        <th style={{ ...thStyle, width: 120 }}>단가</th>
                        <th style={{ ...thStyle, width: 120 }}>소계</th>
                        <th style={{ ...thStyle, width: 36 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {customItems.map(ci => {
                        const sum = calcItemSum(ci)
                        const isFilled = sum > 0 && ci.name
                        return (
                          <tr key={ci._id} style={{ borderBottom: '1px solid #f1f5f9', background: isFilled ? '#eff6ff' : undefined }}>
                            <td style={{ padding: '5px 8px' }}>
                              <select value={ci.cat} onChange={e => updateCI(ci._id, 'cat', e.target.value)} style={{ ...cellInput, textAlign: 'left' }}>
                                {CATS_FOR_CUSTOM.map(c => <option key={c}>{c}</option>)}
                              </select>
                            </td>
                            <td style={{ padding: '5px 8px' }}>
                              <input value={ci.name} onChange={e => updateCI(ci._id, 'name', e.target.value)}
                                placeholder="항목명 입력" style={{ ...cellInput, textAlign: 'left' }} />
                            </td>
                            <td style={{ padding: '4px 6px' }}>
                              <input type="number" min="0" value={ci.day} onChange={e => updateCI(ci._id, 'day', e.target.value)}
                                placeholder="0" style={{ ...cellInput, background: isFilled ? '#dbeafe' : '#fff' }} />
                            </td>
                            <td style={{ padding: '4px 6px' }}>
                              <input type="number" min="0" value={ci.qty} onChange={e => updateCI(ci._id, 'qty', e.target.value)}
                                placeholder="0" style={{ ...cellInput, background: isFilled ? '#dbeafe' : '#fff' }} />
                            </td>
                            <td style={{ padding: '4px 6px' }}>
                              <input type="number" min="0" value={ci.price} onChange={e => updateCI(ci._id, 'price', e.target.value)}
                                style={{ ...cellInput, textAlign: 'right', background: isFilled ? '#dbeafe' : '#f8fafc' }} />
                            </td>
                            <td style={{ padding: '5px 12px', textAlign: 'right', fontSize: 13,
                              fontWeight: isFilled ? 700 : 400, color: isFilled ? '#1e40af' : '#94a3b8' }}>
                              {isFilled ? formatKRW(sum) : '-'}
                            </td>
                            <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                              <button type="button" onClick={() => removeCI(ci._id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', fontSize: 18 }}
                                onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}>×</button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 추가 메모 */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '16px 20px', marginBottom: 20 }}>
              <label style={{ ...labelStyle, marginBottom: 8 }}>추가 메모 (견적서 하단에 표시)</label>
              <textarea
                value={meta.memo || ''}
                onChange={e => setMeta_('memo', e.target.value)}
                placeholder={`예) ※ 최종 결과물\n- 바이럴 영상 (가로)\n- 쇼츠(릴스)용 세로 영상`}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
              />
            </div>

            {/* 할인 + 합계 */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '20px 24px', marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>할인 설정</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={discount.is_first_deal}
                    onChange={e => setDiscount(d => ({ ...d, is_first_deal: e.target.checked }))}
                    style={{ width: 16, height: 16 }} />
                  <span style={{ fontSize: 14, color: '#475569', fontWeight: 500 }}>최초 거래 DC 적용</span>
                </label>
                {discount.is_first_deal && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="number" value={discount.discount_rate} min={0} max={100}
                      onChange={e => setDiscount(d => ({ ...d, discount_rate: e.target.value }))}
                      style={{ ...inputStyle, width: 70, textAlign: 'center' }} />
                    <span style={{ fontSize: 13, color: '#64748b' }}>% DC</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div />
                <div style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 18px' }}>
                  {[
                    ['공급가액 (합계)', subTotal],
                    ['부가세 포함 (VAT 10%)', totalWithVat],
                    ['만원 이하 절사', roundDown],
                  ].map(([l, v]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748b', marginBottom: 6 }}>
                      <span>{l}</span><span>{formatKRW(v)}원</span>
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 8, marginTop: 4,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                      최종 제안가 (VAT 포함)
                      {discount.is_first_deal && <span style={{ fontSize: 11, color: '#7c3aed', marginLeft: 6 }}>{discount.discount_rate}% DC</span>}
                    </span>
                    <span style={{ fontSize: 22, fontWeight: 700, color: '#2563eb' }}>{formatKRW(finalAmount)}원</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 다음 단계 버튼 */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  if (!meta.project_title.trim()) { alert('프로젝트명을 입력해주세요'); return }
                  if (selectedItems.length === 0) { alert('최소 하나 이상의 항목을 입력해주세요'); return }
                  setStep(2)
                }}
                style={{ ...btnPrimary, padding: '11px 32px', fontSize: 15 }}>
                견적서 생성 →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: 견적서 미리보기 ── */}
        {step === 2 && (
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <button onClick={() => setStep(1)} style={{ ...btnCancel, display: 'flex', alignItems: 'center', gap: 6 }}>
                ← 산출 양식으로 돌아가기
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowCompModal(true)} style={{ ...btnPrimary, background: '#7c3aed' }}>
                  📊 비교견적서
                </button>
                <PrintButton meta={meta} values={values} customItems={customItems} discount={discount} clients={clients} />
                <button onClick={handleSave} disabled={saving} style={{
                  ...btnPrimary, background: saving ? '#93c5fd' : '#16a34a', cursor: saving ? 'not-allowed' : 'pointer',
                }}>
                  {saving ? '저장 중...' : '💾 저장'}
                </button>
              </div>
            </div>
            <PreviewDoc meta={meta} values={values} customItems={customItems} discount={discount} clients={clients} />
            {showCompModal && (
              <ComparisonQuotesModal
                items={getSelectedItems(values, customItems)}
                finalAmount={finalAmount}
                meta={meta}
                clientName={clients.find(c => c.id === meta.client_id)?.name || meta.client_name_override || ''}
                onClose={() => setShowCompModal(false)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── 견적서 문서 컴포넌트 (미리보기용) ──────────────────────────────────────
function PreviewDoc({ meta, values, customItems = [], discount, clients }) {
  const logo  = getLogo()
  const stamp = getStamp()
  const clientName = clients.find(c => c.id === meta.client_id)?.name || meta.client_name_override || ''
  const { subTotal, totalWithVat, roundDown, finalAmount } =
    calcTotals(values, customItems, discount.discount_rate, discount.is_first_deal)

  const selectedItems = [
    ...ALL_ITEMS
      .filter(item => calcItemSum(values[itemKey(item)] || {}) > 0)
      .map(item => {
        const v = values[itemKey(item)]
        const displayName = (v.nameOverride && v.nameOverride.trim()) ? v.nameOverride.trim() : item.name
        return { ...item, name: displayName, day: Number(v.day)||1, qty: Number(v.qty)||1, price: Number(v.price)||0 }
      }),
    ...customItems
      .filter(ci => ci.name && calcItemSum(ci) > 0)
      .map(ci => ({ cat: ci.cat, name: ci.name, day: Number(ci.day)||1, qty: Number(ci.qty)||1, price: Number(ci.price)||0 })),
  ]

  const PREVIEW_CATS = ['Pre-production', 'production', 'Post-production', '기타']
  const grouped = PREVIEW_CATS.reduce((acc, c) => {
    acc[c] = selectedItems.filter(i => i.cat === c)
    return acc
  }, {})

  const quoteDateStr = (() => {
    const d = new Date(meta.quote_date)
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}.`
  })()

  const dcNote = discount.is_first_deal ? ` / 최초 거래 ${discount.discount_rate}% DC` : ''

  return (
    <div id="preview-doc" style={{
      width: 794, margin: '0 auto', background: '#fff',
      padding: '56px 60px 80px',
      fontFamily: "'Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',sans-serif",
      boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
      minHeight: 1123,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 6 }}>
        <div style={{ fontSize: 38, fontWeight: 800, color: '#1a1a1a', letterSpacing: '-1px' }}>견적서</div>
        <div style={{ textAlign: 'right' }}>
          {logo
            ? <img src={logo} style={{ maxHeight: 48, maxWidth: 160, objectFit: 'contain', display: 'block', marginLeft: 'auto' }} />
            : <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a' }}>{PROVIDER.name}</div>
          }
          <div style={{ fontSize: 12, color: '#777', marginTop: 3 }}>{PROVIDER.bank}</div>
        </div>
      </div>
      <div style={{ borderTop: '1.5px solid #1a1a1a' }} />

      {/* 정보 행 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.65fr 1.2fr 1.5fr', borderBottom: '1px solid #e0e0e0' }}>
        <InfoCell label="Provider Info." border>
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 3 }}>{PROVIDER.name}</div>
            <div style={{ fontSize: 11, color: '#555', marginBottom: 2 }}>{PROVIDER.bizno}</div>
            <div style={{ fontSize: 11, color: '#555', marginBottom: 2, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{PROVIDER.address}</div>
            <div style={{ fontSize: 11, color: '#555' }}>대표 {PROVIDER.rep}</div>
            {stamp && <img src={stamp} style={{ position: 'absolute', right: 0, top: -6, width: 68, height: 68, objectFit: 'contain', opacity: 0.88, transform: 'rotate(-8deg)' }} />}
          </div>
        </InfoCell>
        <InfoCell label="Date" border>
          <div style={{ fontSize: 13, color: '#1a1a1a' }}>{quoteDateStr}</div>
        </InfoCell>
        <InfoCell label="Client Info" border>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{clientName}</div>
        </InfoCell>
        <InfoCell label="최종 제안가 (VAT 포함)" sub={`( 만원 이하 절사${dcNote} )`}>
          <div style={{ fontSize: 38, fontWeight: 700, color: '#1a1a1a', letterSpacing: '-1px', lineHeight: 1.1 }}>
            {formatKRW(finalAmount)}
          </div>
        </InfoCell>
      </div>

      {/* 프로젝트명 */}
      <div style={{ marginTop: 28, marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 600, color: '#1a1a1a' }}>{meta.project_title}</div>
      </div>

      {/* 항목 테이블 */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderTop: '1.5px solid #1a1a1a', borderBottom: '1.5px solid #1a1a1a' }}>
            <th style={{ width: 90, padding: '9px 8px 9px 0', textAlign: 'left', fontSize: 13, fontWeight: 700 }}></th>
            <th style={{ padding: '9px 10px', textAlign: 'left', fontSize: 13, fontWeight: 700 }}>Contents</th>
            <th style={{ padding: '9px 10px', textAlign: 'right', fontSize: 13, fontWeight: 700 }}>Each price</th>
            <th style={{ padding: '9px 10px', textAlign: 'center', fontSize: 13, fontWeight: 700 }}>Qty</th>
            <th style={{ padding: '9px 10px', textAlign: 'center', fontSize: 13, fontWeight: 700 }}>Day</th>
            <th style={{ padding: '9px 0 9px 10px', textAlign: 'right', fontSize: 13, fontWeight: 700 }}>Sum</th>
          </tr>
        </thead>
        <tbody>
          {PREVIEW_CATS.map(cat => {
            const items = grouped[cat] || []
            if (!items.length) return null
            return items.map((item, idx) => (
              <tr key={`${cat}-${idx}`} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '7px 8px 7px 0', fontSize: 12, color: '#777', verticalAlign: 'top' }}>
                  {idx === 0 ? cat : ''}
                </td>
                <td style={{ padding: '7px 10px', fontSize: 13, color: '#1a1a1a' }}>{item.name}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', fontSize: 13, color: '#1a1a1a' }}>
                  {item.price.toLocaleString('ko-KR')}
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'center', fontSize: 13, color: '#1a1a1a' }}>{item.qty}</td>
                <td style={{ padding: '7px 10px', textAlign: 'center', fontSize: 13, color: '#1a1a1a' }}>{item.day}</td>
                <td style={{ padding: '7px 0 7px 10px', textAlign: 'right', fontSize: 13, color: '#1a1a1a' }}>
                  {(item.price * item.qty * item.day).toLocaleString('ko-KR')}
                </td>
              </tr>
            ))
          })}
          <tr style={{ height: 40 }} />
        </tbody>
      </table>

      {meta.memo && meta.memo.trim() && (
        <div style={{ marginTop: 18, fontSize: 12, color: '#1a1a1a', whiteSpace: 'pre-line', lineHeight: 1.7 }}>
          {meta.memo}
        </div>
      )}

      {/* 합계 푸터 */}
      <div style={{ borderTop: '1.5px solid #1a1a1a', paddingTop: 12, marginTop: 'auto', flexShrink: 0 }}>
        {[
          ['Sub total', subTotal, false],
          ['Total (부가세 포함 금액)', totalWithVat, false],
          [`Round Down Total (만원 이하 절사${dcNote})`, finalAmount, true],
        ].map(([label, val, bold]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
            <span style={{ fontSize: 12, color: '#555' }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: bold ? 600 : 400, color: '#1a1a1a' }}>
              {Number(val).toLocaleString('ko-KR')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function InfoCell({ label, sub, border, children }) {
  return (
    <div style={{ padding: border ? '14px 14px 14px 0' : '14px 0 14px 16px', borderRight: border ? '1px solid #e0e0e0' : undefined }}>
      <div style={{ fontSize: 11, color: '#999', marginBottom: sub ? 4 : 10 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: '#999', marginBottom: 10 }}>{sub}</div>}
      {children}
    </div>
  )
}

// ── 인쇄 버튼 ─────────────────────────────────────────────────────────────
function PrintButton({ meta, values, customItems = [], discount, clients }) {
  const logo  = getLogo()
  const stamp = getStamp()
  const clientName = clients.find(c => c.id === meta.client_id)?.name || meta.client_name_override || ''
  const { subTotal, totalWithVat, roundDown, finalAmount } =
    calcTotals(values, customItems, discount.discount_rate, discount.is_first_deal)

  const PREVIEW_CATS = ['Pre-production', 'production', 'Post-production', '기타']
  const selectedItems = [
    ...ALL_ITEMS
      .filter(item => calcItemSum(values[itemKey(item)] || {}) > 0)
      .map(item => {
        const v = values[itemKey(item)]
        const displayName = (v.nameOverride && v.nameOverride.trim()) ? v.nameOverride.trim() : item.name
        return { ...item, name: displayName, day: Number(v.day)||1, qty: Number(v.qty)||1, price: Number(v.price)||0 }
      }),
    ...customItems
      .filter(ci => ci.name && calcItemSum(ci) > 0)
      .map(ci => ({ cat: ci.cat, name: ci.name, day: Number(ci.day)||1, qty: Number(ci.qty)||1, price: Number(ci.price)||0 })),
  ]

  const dcNote = discount.is_first_deal ? ` / 최초 거래 ${discount.discount_rate}% DC` : ''
  const qd = new Date(meta.quote_date)
  const qdStr = `${qd.getFullYear()}.${String(qd.getMonth()+1).padStart(2,'0')}.${String(qd.getDate()).padStart(2,'0')}.`

  const rowsHtml = PREVIEW_CATS.map(cat => {
    const items = selectedItems.filter(i => i.cat === cat)
    return items.map((item, idx) => `
      <tr style="border-bottom:1px solid #f0f0f0;">
        <td style="padding:7px 8px 7px 0;font-size:12px;color:#777;vertical-align:top;width:90px;">${idx===0?cat:''}</td>
        <td style="padding:7px 10px;font-size:13px;color:#1a1a1a;">${item.name}</td>
        <td style="padding:7px 10px;text-align:right;font-size:13px;">${item.price.toLocaleString('ko-KR')}</td>
        <td style="padding:7px 10px;text-align:center;font-size:13px;">${item.qty}</td>
        <td style="padding:7px 10px;text-align:center;font-size:13px;">${item.day}</td>
        <td style="padding:7px 0 7px 10px;text-align:right;font-size:13px;">${(item.price*item.qty*item.day).toLocaleString('ko-KR')}</td>
      </tr>`).join('')
  }).join('')

  const fileTitle = `루나모 견적서(${qdStr.replace(/\.$/, '')}) - ${meta.project_title}`
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${fileTitle}</title>
<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',sans-serif;background:white;}
@media print{@page{size:A4;margin:0;}body{margin:0;}}</style></head>
<body><div style="width:794px;margin:0 auto;padding:56px 60px 80px;background:white;min-height:1123px;display:flex;flex-direction:column;">
<div style="display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:6px;">
  <div style="font-size:38px;font-weight:800;color:#1a1a1a;letter-spacing:-1px;">견적서</div>
  <div style="text-align:right;">${logo ? `<img src="${logo}" style="max-height:48px;max-width:160px;object-fit:contain;display:block;margin-left:auto;"/>` : `<div style="font-size:15px;font-weight:600;">${PROVIDER.name}</div>`}<div style="font-size:12px;color:#777;margin-top:3px;">${PROVIDER.bank}</div></div>
</div>
<div style="border-top:1.5px solid #1a1a1a;"></div>
<div style="display:grid;grid-template-columns:1.4fr 0.65fr 1.2fr 1.5fr;">
  <div style="padding:14px 14px 14px 0;border-right:1px solid #e0e0e0;"><div style="font-size:11px;color:#999;margin-bottom:10px;">Provider Info.</div><div style="position:relative;"><div style="font-size:13px;font-weight:600;margin-bottom:3px;">${PROVIDER.name}</div><div style="font-size:11px;color:#555;margin-bottom:2px;">${PROVIDER.bizno}</div><div style="font-size:11px;color:#555;margin-bottom:2px;line-height:1.5;">${PROVIDER.address.replace('\n', '<br>')}</div><div style="font-size:11px;color:#555;">대표 ${PROVIDER.rep}</div>${stamp ? `<img src="${stamp}" style="position:absolute;right:0;top:-6px;width:68px;height:68px;object-fit:contain;opacity:0.88;transform:rotate(-8deg);"/>` : ''}</div></div>
  <div style="padding:14px;border-right:1px solid #e0e0e0;"><div style="font-size:11px;color:#999;margin-bottom:10px;">Date</div><div style="font-size:13px;">${qdStr}</div></div>
  <div style="padding:14px;border-right:1px solid #e0e0e0;"><div style="font-size:11px;color:#999;margin-bottom:10px;">Client Info</div><div style="font-size:13px;font-weight:600;">${clientName}</div></div>
  <div style="padding:14px 0 14px 16px;"><div style="font-size:11px;color:#999;margin-bottom:4px;">최종 제안가 (VAT 포함)</div><div style="font-size:10px;color:#999;margin-bottom:10px;">( 만원 이하 절사${dcNote} )</div><div style="font-size:38px;font-weight:700;letter-spacing:-1px;line-height:1.1;">${Number(finalAmount).toLocaleString('ko-KR')}</div></div>
</div>
<div style="border-top:1px solid #e0e0e0;"></div>
<div style="margin-top:28px;margin-bottom:24px;font-size:20px;font-weight:600;">${meta.project_title}</div>
<table style="width:100%;border-collapse:collapse;">
<thead><tr style="border-top:1.5px solid #1a1a1a;border-bottom:1.5px solid #1a1a1a;">
  <th style="width:90px;padding:9px 8px 9px 0;text-align:left;font-size:13px;font-weight:700;"></th>
  <th style="padding:9px 10px;text-align:left;font-size:13px;font-weight:700;">Contents</th>
  <th style="padding:9px 10px;text-align:right;font-size:13px;font-weight:700;">Each price</th>
  <th style="padding:9px 10px;text-align:center;font-size:13px;font-weight:700;">Qty</th>
  <th style="padding:9px 10px;text-align:center;font-size:13px;font-weight:700;">Day</th>
  <th style="padding:9px 0 9px 10px;text-align:right;font-size:13px;font-weight:700;">Sum</th>
</tr></thead>
<tbody>${rowsHtml}<tr style="height:40px;"></tr></tbody></table>
${meta.memo && meta.memo.trim() ? `<div style="margin-top:18px;font-size:12px;color:#1a1a1a;white-space:pre-line;line-height:1.7;">${String(meta.memo).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</div>` : ''}
<div style="border-top:1.5px solid #1a1a1a;padding-top:12px;margin-top:auto;flex-shrink:0;">
  <div style="display:flex;justify-content:space-between;padding:5px 0;"><span style="font-size:12px;color:#555;">Sub total</span><span style="font-size:13px;">${Number(subTotal).toLocaleString('ko-KR')}</span></div>
  <div style="display:flex;justify-content:space-between;padding:5px 0;"><span style="font-size:12px;color:#555;">Total (부가세 포함 금액)</span><span style="font-size:13px;">${Number(totalWithVat).toLocaleString('ko-KR')}</span></div>
  <div style="display:flex;justify-content:space-between;padding:5px 0;"><span style="font-size:12px;color:#555;">Round Down Total (만원 이하 절사${dcNote})</span><span style="font-size:13px;font-weight:600;">${Number(finalAmount).toLocaleString('ko-KR')}</span></div>
</div>
</div></body></html>`

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=900,height=800')
    win.document.write(html)
    win.document.close()
    setTimeout(() => win.print(), 500)
  }

  return (
    <button onClick={handlePrint} style={{ ...btnPrimary, background: '#475569' }}>
      🖨️ 인쇄 / PDF 저장
    </button>
  )
}

// ── 헬퍼 컴포넌트 ─────────────────────────────────────────────────────────
function EditableName({ defaultName, override, onChange, isFilled }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(override || '')
  useEffect(() => { setDraft(override || '') }, [override])
  const display = override && override.trim() ? override : defaultName
  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { onChange(draft.trim()); setEditing(false) }}
        onKeyDown={e => {
          if (e.key === 'Enter') { onChange(draft.trim()); setEditing(false) }
          if (e.key === 'Escape') { setDraft(override || ''); setEditing(false) }
        }}
        placeholder={defaultName}
        style={{
          width: '100%', padding: '3px 6px', fontSize: 13, border: '1px solid #2563eb',
          borderRadius: 4, background: '#fff', outline: 'none',
          color: isFilled ? '#1e40af' : '#374151', fontWeight: isFilled ? 600 : 400,
        }}
      />
    )
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
      title="클릭하여 항목명 수정 (이 견적서에만 적용)"
      onClick={() => setEditing(true)}>
      <span style={{ borderBottom: '1px dashed transparent' }}
        onMouseEnter={e => e.currentTarget.style.borderBottomColor = '#cbd5e1'}
        onMouseLeave={e => e.currentTarget.style.borderBottomColor = 'transparent'}>
        {display}
      </span>
      {override && override.trim() && (
        <button type="button"
          onClick={e => { e.stopPropagation(); onChange('') }}
          title="원본으로 되돌리기"
          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 11, padding: 0 }}>
          ↺
        </button>
      )}
    </span>
  )
}

function BumpHeader({ label, onUp, onDown }) {
  const btn = {
    border: 'none', background: 'none', cursor: 'pointer',
    color: '#64748b', fontSize: 9, lineHeight: 1, padding: 0, display: 'block',
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
      {label}
      <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 1 }}>
        <button type="button" onClick={onUp} style={btn} title={`${label} 일괄 +1`}>▲</button>
        <button type="button" onClick={onDown} style={btn} title={`${label} 일괄 -1`}>▼</button>
      </span>
    </span>
  )
}

// ── 목록에서 미리보기 (저장된 견적서) ─────────────────────────────────────
function QuotePreviewModal({ quote, clients, onClose }) {
  const [showCompModal, setShowCompModal] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const { values, customItems } = parseDbItems(quote.items || [])
  const meta = {
    quote_date: quote.quote_date,
    client_id: quote.client_id || '',
    client_name_override: quote.client_name_override || '',
    project_title: quote.project_title,
    status: quote.status,
    memo: quote.memo || '',
  }
  const discount = { is_first_deal: quote.is_first_deal, discount_rate: quote.discount_rate }
  const clientName = quote.clients?.name || quote.client_name_override || ''
  const clientEmail = quote.clients?.email || ''
  const { subTotal, finalAmount } = calcTotals(values, customItems, discount.discount_rate, discount.is_first_deal)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)', display: 'flex', flexDirection: 'column', zIndex: 1000 }}>
      <div style={{ background: '#1e293b', padding: '10px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 500 }}>견적서 미리보기 — {quote.project_title}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowCompModal(true)} style={{ ...btnPrimary, background: '#7c3aed' }}>📊 비교견적서</button>
          <button onClick={() => setShowEmailModal(true)} style={{ ...btnPrimary, background: '#059669' }}>✉️ 이메일 발송</button>
          <PrintButton meta={meta} values={values} customItems={customItems} discount={discount} clients={clients} />
          <button onClick={onClose} style={{ padding: '7px 18px', borderRadius: 8, border: '1px solid #475569', background: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: 13 }}>닫기</button>
        </div>
      </div>
      {showEmailModal && (
        <SendQuoteEmailModal
          quote={quote}
          clientName={clientName}
          clientEmail={clientEmail}
          subTotal={subTotal}
          finalAmount={finalAmount}
          items={getSelectedItems(values, customItems)}
          onClose={() => setShowEmailModal(false)}
        />
      )}
      <div style={{ flex: 1, overflow: 'auto', padding: '32px', display: 'flex', justifyContent: 'center' }}>
        <PreviewDoc meta={meta} values={values} customItems={customItems} discount={discount} clients={clients} />
      </div>
      {showCompModal && (
        <ComparisonQuotesModal
          items={getSelectedItems(values, customItems)}
          finalAmount={quote.final_amount || 0}
          meta={meta}
          clientName={clientName}
          onClose={() => setShowCompModal(false)}
        />
      )}
    </div>
  )
}

// ── 로고/도장 설정 모달 ────────────────────────────────────────────────────
function ImageSettingsModal({ onClose }) {
  const [logo,  setLogoState]  = useState(getLogo())
  const [stamp, setStampState] = useState(getStamp())

  const handleFile = (type, e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const b64 = ev.target.result
      if (type === 'logo')  { setLogo(b64);  setLogoState(b64) }
      else                  { setStamp(b64); setStampState(b64) }
    }
    reader.readAsDataURL(file)
  }

  const handleClear = (type) => {
    if (type === 'logo')  { setLogo('');  setLogoState('') }
    else                  { setStamp(''); setStampState('') }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: 440, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', marginBottom: 24 }}>🖼 로고 / 도장 설정</h3>

        {/* 로고 */}
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>회사 로고</label>
          {logo && <img src={logo} style={{ height: 50, maxWidth: 200, objectFit: 'contain', display: 'block', marginBottom: 10, border: '1px solid #e2e8f0', borderRadius: 8, padding: 6 }} />}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer', fontSize: 13, color: '#475569', background: '#f8fafc' }}>
              이미지 선택
              <input type="file" accept="image/*" onChange={e => handleFile('logo', e)} style={{ display: 'none' }} />
            </label>
            {logo && <button onClick={() => handleClear('logo')} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #fecaca', background: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>삭제</button>}
          </div>
        </div>

        {/* 도장 */}
        <div style={{ marginBottom: 28 }}>
          <label style={labelStyle}>회사 도장 (인감)</label>
          {stamp && <img src={stamp} style={{ height: 70, width: 70, objectFit: 'contain', display: 'block', marginBottom: 10, border: '1px solid #e2e8f0', borderRadius: 8, padding: 6 }} />}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer', fontSize: 13, color: '#475569', background: '#f8fafc' }}>
              이미지 선택
              <input type="file" accept="image/*" onChange={e => handleFile('stamp', e)} style={{ display: 'none' }} />
            </label>
            {stamp && <button onClick={() => handleClear('stamp')} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #fecaca', background: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>삭제</button>}
          </div>
          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>PNG(투명 배경) 권장. 업체 정보 영역에 반투명 도장으로 표시됩니다.</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnPrimary}>완료</button>
        </div>
      </div>
    </div>
  )
}

// ── 비교견적서 ─────────────────────────────────────────────────────────────
const COMP_DEFAULTS = [
  {
    id: 'A', multiplier: 1.07,
    name: '파람', bizno: '187-08-01694',
    address: '부산 동구 중앙대로 319 9층',
    rep: '정영진', bank: '',
  },
  {
    id: 'B', multiplier: 1.12,
    name: '필앤앰프티(fill/empty)', bizno: '619-59-00438',
    address: '부산광역시 수영구 광안로7번길 33, 마린캐슬A 502호',
    rep: '박은지', bank: '',
  },
]

const getCompCompanies = () => {
  try {
    const s = localStorage.getItem('comp_companies')
    if (s) return JSON.parse(s).map((c, i) => ({ ...COMP_DEFAULTS[i], ...c }))
  } catch {}
  return COMP_DEFAULTS
}
const setCompCompanies = (data) => { const v = JSON.stringify(data); localStorage.setItem('comp_companies', v); import('../lib/settings').then(m => m.saveSetting('comp_companies', v)) }

const _sr = (n) => { const x = Math.sin(n + 1) * 10000; return x - Math.floor(x) }

// B형 전용 항목명 매핑 (A형과 차별화)
const COMP_B_NAME_MAP = {
  '기획/제작준비':       'Pre-Production',
  '연출':               '프로덕션 디렉팅',
  '촬영':               '카메라 & 그립',
  '조명':               '라이팅',
  '사운드':             '오디오 레코딩',
  '미술/소품':          '아트 디렉션',
  '헤어·메이크업·의상': '스타일링',
  '출연':               '캐스팅',
  '진행비':             '로지스틱스',
  '후반 제작':          'Post-Production',
  '음향·음악':          '사운드 디자인',
  '기타':               '기타',
}

// 비교견적 항목 통합 규칙 – 여러 세부 항목을 큰 카테고리로 합산
const COMP_CONSOLIDATION = [
  { cat: 'Pre-production', name: '기획/제작준비',
    match: i => i.cat === 'Pre-production' },
  { cat: 'production',     name: '연출',
    match: i => ['PD','제작부','감독','연출부'].includes(i.name) },
  { cat: 'production',     name: '촬영',
    match: i => ['촬영감독','촬영부','그립','카메라','렌즈','그립장비','크레인'].includes(i.name) },
  { cat: 'production',     name: '조명',
    match: i => ['조명감독','조명부','조명장비'].includes(i.name) },
  { cat: 'production',     name: '사운드',
    match: i => ['사운드감독','사운드팀','녹음기'].includes(i.name) },
  { cat: 'production',     name: '미술/소품',
    match: i => ['미술감독','미술팀','소품제작','소품대여','세트대여','미술 기타'].includes(i.name) },
  { cat: 'production',     name: '헤어·메이크업·의상',
    match: i => ['의상','분장'].includes(i.name) },
  { cat: 'production',     name: '출연',
    match: i => ['모델','보조출연'].includes(i.name) },
  { cat: 'production',     name: '진행비',
    match: i => ['차량대여','식대 및 기타','출장비','지원','장소대여'].includes(i.name) },
  { cat: 'Post-production',name: '후반 제작',
    match: i => ['편집','CG','2D 그래픽','3D 그래픽','자막','색보정'].includes(i.name) },
  { cat: 'Post-production',name: '음향·음악',
    match: i => ['녹음료','음악','폴리','성우료','번역 및 감수'].includes(i.name) },
  { cat: '기타',           name: '기타',
    match: i => i.cat === '기타' },
]

const genCompItems = (items, lunamoFinal, multiplier, ci) => {
  if (!items.length) return []
  const targetFinal = Math.floor((lunamoFinal * multiplier) / 10000) * 10000

  // 1. 항목 통합 – 세부 항목들을 큰 카테고리로 합산
  const matched = new Set()
  const groups = []
  for (const rule of COMP_CONSOLIDATION) {
    const hit = items.filter(it => rule.match(it))
    if (!hit.length) continue
    const sum = hit.reduce((s, it) => s + it.price * (it.qty || 1) * (it.day || 1), 0)
    if (sum <= 0) continue
    groups.push({ cat: rule.cat, name: rule.name, bName: COMP_B_NAME_MAP[rule.name] || rule.name, price: sum, qty: 1, day: 1 })
    hit.forEach(it => matched.add(it))
  }
  // 매핑 안된 항목은 기타로
  const unmatched = items.filter(it => !matched.has(it))
  if (unmatched.length) {
    const s = unmatched.reduce((sum, it) => sum + it.price * (it.qty||1) * (it.day||1), 0)
    if (s > 0) {
      const ex = groups.find(g => g.name === '기타')
      if (ex) ex.price += s
      else groups.push({ cat: '기타', name: '기타', bName: '기타', price: s, qty: 1, day: 1 })
    }
  }
  if (!groups.length) return []

  // 2. 그룹별 금액 랜덤 변동 (업체별 특색)
  const varied = groups.map((g, i) => ({
    ...g,
    price: Math.max(Math.round(g.price * (0.87 + _sr(i * 13 + ci * 31) * 0.28) / 1000) * 1000, 1000),
  }))

  // 3. 목표 금액에 맞게 스케일
  const variedSub = varied.reduce((s, it) => s + it.price, 0)
  if (variedSub === 0) return varied
  const scale = (targetFinal / 1.1) / variedSub
  const scaled = varied.map(it => ({
    ...it,
    price: Math.max(Math.round(it.price * scale / 1000) * 1000, 1000),
  }))

  // 4. 반올림 오차 보정
  const actualFinal = Math.floor(Math.round(scaled.reduce((s, it) => s + it.price, 0) * 1.1) / 10000) * 10000
  const diff = targetFinal - actualFinal
  if (diff !== 0) {
    const bi = scaled.reduce((mi, it, i) => it.price > scaled[mi].price ? i : mi, 0)
    scaled[bi] = { ...scaled[bi], price: Math.max(scaled[bi].price + Math.round(diff / 1.1 / 1000) * 1000, 1000) }
  }
  return scaled
}

const getSelectedItems = (values, customItems) => [
  ...ALL_ITEMS.filter(item => calcItemSum(values[itemKey(item)] || {}) > 0)
    .map(item => {
      const v = values[itemKey(item)]
      return { cat: item.cat, name: item.name, day: Number(v.day) || 1, qty: Number(v.qty) || 1, price: Number(v.price) || 0 }
    }),
  ...(customItems || []).filter(ci => ci.name && calcItemSum(ci) > 0)
    .map(ci => ({ cat: ci.cat, name: ci.name, day: Number(ci.day) || 1, qty: Number(ci.qty) || 1, price: Number(ci.price) || 0 })),
]

// 비교견적서 레이아웃 A – 전통형 (적색 테두리, 격식체)
function CompPreviewA({ comp, items, meta, clientName, qdStr, finalAmount, subTotal }) {
  const PCATS = ['Pre-production', 'production', 'Post-production', '기타']
  const vat = Math.round(subTotal * 0.1)
  let no = 0
  return (
    <div style={{
      width: 794, background: '#fff', padding: '50px 52px 70px',
      fontFamily: "'Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',sans-serif",
      boxShadow: '0 8px 40px rgba(0,0,0,0.15)', border: '2px solid #8b0000', position: 'relative',
    }}>
      <div style={{ position: 'absolute', inset: 8, border: '1px solid #c0392b', pointerEvents: 'none' }} />

      {/* 제목 + 공급자 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: 12, color: '#1a1a1a', marginBottom: 4 }}>견  적  서</div>
          <div style={{ fontSize: 11, color: '#999', letterSpacing: 3 }}>ESTIMATE / QUOTATION</div>
        </div>
        <div style={{ border: '1px solid #aaa', padding: '12px 16px', minWidth: 220, fontSize: 12 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              {[['상호', comp.name], ['사업자번호', comp.bizno], ['주소', comp.address], ['대표자', comp.rep], ['계좌', comp.bank]].map(([k, v]) => (
                <tr key={k}>
                  <td style={{ padding: '3px 8px 3px 0', color: '#555', fontWeight: 600, whiteSpace: 'nowrap', width: 68, verticalAlign: 'top' }}>{k}</td>
                  <td style={{ padding: '3px 0', color: '#1a1a1a' }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 수신/건명/금액 */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20, border: '1px solid #bbb' }}>
        <tbody>
          <tr style={{ background: '#f5f5f5' }}>
            {[['수신', clientName || '(귀중)', '38%'], ['견적일자', qdStr, '16%'], ['유효기간', '30일', '12%']].map(([l, v, w], i) => (
              [
                <td key={`l${i}`} style={{ padding: '8px 12px', width: '12%', fontWeight: 600, fontSize: 12, borderRight: '1px solid #bbb', color: '#333', textAlign: 'center' }}>{l}</td>,
                <td key={`v${i}`} style={{ padding: '8px 12px', fontSize: 12, borderRight: i < 2 ? '1px solid #bbb' : undefined, width: w }}>{v}</td>,
              ]
            ))}
          </tr>
          <tr>
            <td style={{ padding: '8px 12px', fontWeight: 600, fontSize: 12, borderRight: '1px solid #bbb', borderTop: '1px solid #bbb', color: '#333', textAlign: 'center' }}>건명</td>
            <td colSpan={5} style={{ padding: '8px 12px', fontSize: 13, fontWeight: 500, borderTop: '1px solid #bbb' }}>{meta.project_title}</td>
          </tr>
          <tr style={{ background: '#fff5f5' }}>
            <td style={{ padding: '10px 12px', fontWeight: 700, fontSize: 12, borderRight: '1px solid #bbb', borderTop: '1px solid #bbb', color: '#8b0000', textAlign: 'center' }}>견적금액</td>
            <td colSpan={5} style={{ padding: '10px 12px', fontSize: 20, fontWeight: 700, color: '#8b0000', borderTop: '1px solid #bbb' }}>
              ₩ {finalAmount.toLocaleString('ko-KR')} 원 (부가세 포함)
            </td>
          </tr>
        </tbody>
      </table>

      {/* 항목 테이블 */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
        <thead>
          <tr style={{ background: '#4a0000', color: '#fff' }}>
            {['No.', '구분', '항목', '금액'].map((h, i) => (
              <th key={h} style={{ padding: '9px 12px', fontSize: 12, fontWeight: 600, textAlign: i >= 3 ? 'right' : i === 0 ? 'center' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PCATS.flatMap(cat => {
            const catItems = items.filter(i => i.cat === cat)
            return catItems.map((item, idx) => {
              no++
              return (
                <tr key={`${cat}-${idx}`} style={{ borderBottom: '1px solid #e5e5e5', background: no % 2 === 0 ? '#fafafa' : '#fff' }}>
                  <td style={{ padding: '9px 12px', fontSize: 12, textAlign: 'center', color: '#aaa', width: 40 }}>{no}</td>
                  <td style={{ padding: '9px 12px', fontSize: 12, color: '#666', width: 110 }}>{idx === 0 ? cat : ''}</td>
                  <td style={{ padding: '9px 12px', fontSize: 13, fontWeight: 500 }}>{item.name}</td>
                  <td style={{ padding: '9px 12px', fontSize: 14, textAlign: 'right', fontWeight: 600, color: '#4a0000', width: 130 }}>{item.price.toLocaleString()}</td>
                </tr>
              )
            })
          })}
        </tbody>
      </table>

      {/* 합계 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: 280 }}>
          <tbody>
            {[['공급가액 합계', subTotal], ['부가가치세 (10%)', vat]].map(([l, v]) => (
              <tr key={l}>
                <td style={{ padding: '7px 16px', fontSize: 12, color: '#555', background: '#f5f5f5', border: '1px solid #ddd', fontWeight: 500 }}>{l}</td>
                <td style={{ padding: '7px 16px', fontSize: 13, textAlign: 'right', border: '1px solid #ddd', minWidth: 120 }}>{v.toLocaleString()}</td>
              </tr>
            ))}
            <tr style={{ background: '#4a0000' }}>
              <td style={{ padding: '9px 16px', fontSize: 13, fontWeight: 700, color: '#fff', border: '1px solid #4a0000' }}>합 계 (VAT 포함)</td>
              <td style={{ padding: '9px 16px', fontSize: 15, textAlign: 'right', fontWeight: 700, color: '#fff', border: '1px solid #4a0000' }}>{finalAmount.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 24, fontSize: 11, color: '#888', lineHeight: 1.7, borderTop: '1px solid #ddd', paddingTop: 14 }}>
        위와 같이 견적드리오니 검토 후 발주해 주시기 바랍니다. 본 견적서는 견적일로부터 30일간 유효합니다.
      </div>
    </div>
  )
}

// 비교견적서 레이아웃 B – 모던형 (네이비 헤더, 단가×수량 방식)
function CompPreviewB({ comp, items, meta, clientName, qdStr, finalAmount, subTotal }) {
  const PCATS = ['Pre-production', 'production', 'Post-production', '기타']
  const vat = Math.round(subTotal * 0.1)
  // 항목별 단가/수량 분할 (시드 기반 고정 랜덤)
  const allItems = PCATS.flatMap(cat => items.filter(i => i.cat === cat))
  const bRows = allItems.map((item, i) => {
    const qty = Math.floor(_sr(i * 19 + 7) * 3) + 1   // 1~3
    const unitPrice = Math.round(item.price / qty / 1000) * 1000 || item.price
    return { ...item, displayQty: qty, unitPrice }
  })
  let rowIdx = 0
  return (
    <div style={{
      width: 794, background: '#fff', overflow: 'hidden',
      fontFamily: "'Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',sans-serif",
      boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
    }}>
      {/* 네이비 헤더 배너 */}
      <div style={{ background: '#1e3a5f', padding: '28px 44px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#fff', letterSpacing: 2 }}>QUOTATION</div>
          <div style={{ fontSize: 13, color: '#93c5fd', marginTop: 4, letterSpacing: 1 }}>견  적  서</div>
        </div>
        <div style={{ textAlign: 'right', color: '#e0e7ef' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{comp.name}</div>
          <div style={{ fontSize: 11, marginTop: 3, opacity: 0.8 }}>{comp.bizno}</div>
          <div style={{ fontSize: 11, marginTop: 2, opacity: 0.8 }}>{comp.address}</div>
          <div style={{ fontSize: 11, marginTop: 2, opacity: 0.8 }}>대표 {comp.rep} | {comp.bank}</div>
        </div>
      </div>

      {/* 수신 정보 스트립 */}
      <div style={{ background: '#f0f4f8', padding: '14px 44px', display: 'flex', gap: 40, borderBottom: '1px solid #d0dce8' }}>
        {[['수신', clientName || '(귀중)'], ['프로젝트', meta.project_title], ['견적일', qdStr], ['유효기간', '30일']].map(([l, v]) => (
          <div key={l}>
            <div style={{ fontSize: 10, color: '#7090a0', fontWeight: 600, marginBottom: 2, letterSpacing: 0.5 }}>{l.toUpperCase()}</div>
            <div style={{ fontSize: 12, color: '#1e3a5f', fontWeight: 500, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</div>
          </div>
        ))}
      </div>

      {/* 총액 하이라이트 */}
      <div style={{ padding: '16px 44px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e0e8f0' }}>
        <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>견적 총액 (VAT 포함)</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#1e3a5f' }}>₩ {finalAmount.toLocaleString()}</div>
      </div>

      {/* 항목 테이블 – 5컬럼: No / 항목명 / 단가 / 수량 / 금액 */}
      <div style={{ padding: '20px 44px 0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#1e3a5f' }}>
              {[['No.', 'center', 36], ['항목명', 'left', null], ['단가', 'right', 110], ['수량', 'center', 54], ['금액', 'right', 120]].map(([h, align, w]) => (
                <th key={h} style={{ padding: '11px 14px', fontSize: 12, fontWeight: 600, color: '#fff', textAlign: align, ...(w ? { width: w } : {}) }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bRows.map((item, i) => {
              const bg = rowIdx++ % 2 === 0 ? '#fff' : '#f7f9fc'
              return (
                <tr key={i} style={{ background: bg, borderBottom: '1px solid #eef2f7' }}>
                  <td style={{ padding: '10px 14px', fontSize: 12, textAlign: 'center', color: '#aaa' }}>{i + 1}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500 }}>{item.bName || item.name}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, textAlign: 'right', color: '#475569' }}>{item.unitPrice.toLocaleString()}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, textAlign: 'center', color: '#475569' }}>{item.displayQty}</td>
                  <td style={{ padding: '10px 14px', fontSize: 14, textAlign: 'right', fontWeight: 700, color: '#1e3a5f' }}>{item.price.toLocaleString()}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 합계 푸터 */}
      <div style={{ padding: '20px 44px 36px', display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ minWidth: 280 }}>
          {[['공급가액', subTotal], ['부가세 (10%)', vat]].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e0e8f0', fontSize: 13, color: '#64748b' }}>
              <span>{l}</span><span>{v.toLocaleString()}</span>
            </div>
          ))}
          <div style={{ background: '#1e3a5f', borderRadius: 8, padding: '12px 16px', marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#93c5fd', fontWeight: 600 }}>합계 (VAT 포함)</span>
            <span style={{ fontSize: 18, color: '#fff', fontWeight: 700 }}>{finalAmount.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 44px', background: '#f0f4f8', fontSize: 11, color: '#7090a0', borderTop: '1px solid #d0dce8', lineHeight: 1.7 }}>
        상기 금액으로 견적 드립니다. 본 견적서의 유효기간은 발행일로부터 30일입니다.
      </div>
    </div>
  )
}

// 인쇄 HTML 빌더 – A형
const buildCompHtmlA = (comp, items, meta, clientName, qdStr, subTotal, finalAmount) => {
  const PCATS = ['Pre-production', 'production', 'Post-production', '기타']
  const vat = Math.round(subTotal * 0.1)
  let no = 0
  const rows = PCATS.flatMap(cat => {
    const catItems = items.filter(i => i.cat === cat)
    return catItems.map((item, idx) => {
      no++
      const bg = no % 2 === 0 ? '#fafafa' : '#fff'
      return `<tr style="border-bottom:1px solid #e5e5e5;background:${bg};">
        <td style="padding:9px 12px;font-size:12px;text-align:center;color:#aaa;width:40px;">${no}</td>
        <td style="padding:9px 12px;font-size:12px;color:#666;width:110px;">${idx === 0 ? cat : ''}</td>
        <td style="padding:9px 12px;font-size:13px;font-weight:500;">${item.name}</td>
        <td style="padding:9px 12px;font-size:14px;text-align:right;font-weight:600;color:#4a0000;width:130px;">${item.price.toLocaleString()}</td>
      </tr>`
    })
  }).join('')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>견적서 - ${meta.project_title}</title>
<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',sans-serif;}
@media print{@page{size:A4;margin:0;}body{margin:0;}}</style></head><body>
<div style="width:794px;margin:0 auto;background:#fff;padding:50px 52px 70px;border:2px solid #8b0000;position:relative;min-height:1100px;">
<div style="position:absolute;inset:8px;border:1px solid #c0392b;pointer-events:none;"></div>
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;">
  <div><div style="font-size:36px;font-weight:900;letter-spacing:12px;color:#1a1a1a;margin-bottom:4px;">견  적  서</div>
  <div style="font-size:11px;color:#999;letter-spacing:3px;">ESTIMATE / QUOTATION</div></div>
  <div style="border:1px solid #aaa;padding:12px 16px;min-width:220px;font-size:12px;">
    <table style="border-collapse:collapse;width:100%;"><tbody>
      ${[['상호', comp.name], ['사업자번호', comp.bizno], ['주소', comp.address], ['대표자', comp.rep], ['계좌', comp.bank]].map(([k, v]) =>
        `<tr><td style="padding:3px 8px 3px 0;color:#555;font-weight:600;white-space:nowrap;width:68px;vertical-align:top;">${k}</td><td style="padding:3px 0;">${v}</td></tr>`
      ).join('')}
    </tbody></table>
  </div>
</div>
<table style="width:100%;border-collapse:collapse;margin-bottom:20px;border:1px solid #bbb;"><tbody>
  <tr style="background:#f5f5f5;">
    <td style="padding:8px 12px;width:12%;font-weight:600;font-size:12px;border-right:1px solid #bbb;text-align:center;">수신</td>
    <td style="padding:8px 12px;font-size:12px;border-right:1px solid #bbb;width:38%;">${clientName || '(귀중)'}</td>
    <td style="padding:8px 12px;width:12%;font-weight:600;font-size:12px;border-right:1px solid #bbb;text-align:center;">견적일자</td>
    <td style="padding:8px 12px;font-size:12px;border-right:1px solid #bbb;width:16%;">${qdStr}</td>
    <td style="padding:8px 12px;width:10%;font-weight:600;font-size:12px;border-right:1px solid #bbb;text-align:center;">유효기간</td>
    <td style="padding:8px 12px;font-size:12px;">30일</td>
  </tr>
  <tr><td style="padding:8px 12px;font-weight:600;font-size:12px;border-right:1px solid #bbb;border-top:1px solid #bbb;text-align:center;">건명</td>
    <td colspan="5" style="padding:8px 12px;font-size:13px;font-weight:500;border-top:1px solid #bbb;">${meta.project_title}</td></tr>
  <tr style="background:#fff5f5;"><td style="padding:10px 12px;font-weight:700;font-size:12px;border-right:1px solid #bbb;border-top:1px solid #bbb;color:#8b0000;text-align:center;">견적금액</td>
    <td colspan="5" style="padding:10px 12px;font-size:20px;font-weight:700;color:#8b0000;border-top:1px solid #bbb;">₩ ${finalAmount.toLocaleString()} 원 (부가세 포함)</td></tr>
</tbody></table>
<table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
<thead><tr style="background:#4a0000;color:#fff;">
  <th style="padding:9px 12px;font-size:12px;font-weight:600;text-align:center;white-space:nowrap;">No.</th>
  <th style="padding:9px 12px;font-size:12px;font-weight:600;text-align:left;white-space:nowrap;">구분</th>
  <th style="padding:9px 12px;font-size:12px;font-weight:600;text-align:left;">항목</th>
  <th style="padding:9px 12px;font-size:12px;font-weight:600;text-align:right;white-space:nowrap;">금액</th>
</tr></thead>
<tbody>${rows}</tbody></table>
<div style="display:flex;justify-content:flex-end;">
<table style="border-collapse:collapse;min-width:280px;"><tbody>
  <tr><td style="padding:7px 16px;font-size:12px;color:#555;background:#f5f5f5;border:1px solid #ddd;font-weight:500;">공급가액 합계</td><td style="padding:7px 16px;font-size:13px;text-align:right;border:1px solid #ddd;min-width:120px;">${subTotal.toLocaleString()}</td></tr>
  <tr><td style="padding:7px 16px;font-size:12px;color:#555;background:#f5f5f5;border:1px solid #ddd;font-weight:500;">부가가치세 (10%)</td><td style="padding:7px 16px;font-size:13px;text-align:right;border:1px solid #ddd;">${vat.toLocaleString()}</td></tr>
  <tr style="background:#4a0000;"><td style="padding:9px 16px;font-size:13px;font-weight:700;color:#fff;border:1px solid #4a0000;">합 계 (VAT 포함)</td><td style="padding:9px 16px;font-size:15px;text-align:right;font-weight:700;color:#fff;border:1px solid #4a0000;">${finalAmount.toLocaleString()}</td></tr>
</tbody></table></div>
<div style="margin-top:24px;font-size:11px;color:#888;line-height:1.7;border-top:1px solid #ddd;padding-top:14px;">위와 같이 견적드리오니 검토 후 발주해 주시기 바랍니다. 본 견적서는 견적일로부터 30일간 유효합니다.</div>
</div></body></html>`
}

// 인쇄 HTML 빌더 – B형
const buildCompHtmlB = (comp, items, meta, clientName, qdStr, subTotal, finalAmount) => {
  const PCATS = ['Pre-production', 'production', 'Post-production', '기타']
  const vat = Math.round(subTotal * 0.1)
  const allItems = PCATS.flatMap(cat => items.filter(i => i.cat === cat))
  let rowIdx = 0
  const rows = allItems.map((item, i) => {
    const qty = Math.floor(_sr(i * 19 + 7) * 3) + 1
    const unitPrice = Math.round(item.price / qty / 1000) * 1000 || item.price
    const bg = rowIdx++ % 2 === 0 ? '#fff' : '#f7f9fc'
    return `<tr style="background:${bg};border-bottom:1px solid #eef2f7;">
      <td style="padding:10px 14px;font-size:12px;text-align:center;color:#aaa;width:36px;">${i + 1}</td>
      <td style="padding:10px 14px;font-size:13px;font-weight:500;">${item.bName || item.name}</td>
      <td style="padding:10px 14px;font-size:13px;text-align:right;color:#475569;width:110px;">${unitPrice.toLocaleString()}</td>
      <td style="padding:10px 14px;font-size:13px;text-align:center;color:#475569;width:54px;">${qty}</td>
      <td style="padding:10px 14px;font-size:14px;text-align:right;font-weight:700;color:#1e3a5f;width:120px;">${item.price.toLocaleString()}</td>
    </tr>`
  }).join('')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>견적서 - ${meta.project_title}</title>
<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',sans-serif;}
@media print{@page{size:A4;margin:0;}body{margin:0;}}</style></head><body>
<div style="width:794px;margin:0 auto;background:#fff;min-height:1100px;overflow:hidden;">
<div style="background:#1e3a5f;padding:28px 44px;display:flex;justify-content:space-between;align-items:center;">
  <div><div style="font-size:32px;font-weight:700;color:#fff;letter-spacing:2px;">QUOTATION</div>
  <div style="font-size:13px;color:#93c5fd;margin-top:4px;letter-spacing:1px;">견  적  서</div></div>
  <div style="text-align:right;color:#e0e7ef;">
    <div style="font-size:15px;font-weight:700;color:#fff;">${comp.name}</div>
    <div style="font-size:11px;margin-top:3px;opacity:0.8;">${comp.bizno}</div>
    <div style="font-size:11px;margin-top:2px;opacity:0.8;">${comp.address}</div>
    <div style="font-size:11px;margin-top:2px;opacity:0.8;">대표 ${comp.rep} | ${comp.bank}</div>
  </div>
</div>
<div style="background:#f0f4f8;padding:14px 44px;display:flex;gap:40px;border-bottom:1px solid #d0dce8;">
  ${[['수신', clientName || '(귀중)'], ['프로젝트', meta.project_title], ['견적일', qdStr], ['유효기간', '30일']].map(([l, v]) =>
    `<div><div style="font-size:10px;color:#7090a0;font-weight:600;margin-bottom:2px;">${l.toUpperCase()}</div><div style="font-size:12px;color:#1e3a5f;font-weight:500;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${v}</div></div>`
  ).join('')}
</div>
<div style="padding:16px 44px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e0e8f0;">
  <div style="font-size:13px;color:#64748b;font-weight:500;">견적 총액 (VAT 포함)</div>
  <div style="font-size:28px;font-weight:700;color:#1e3a5f;">₩ ${finalAmount.toLocaleString()}</div>
</div>
<div style="padding:20px 44px 0;">
<table style="width:100%;border-collapse:collapse;">
<thead><tr style="background:#1e3a5f;">
  <th style="padding:11px 14px;font-size:12px;font-weight:600;color:#fff;text-align:center;width:36px;">No.</th>
  <th style="padding:11px 14px;font-size:12px;font-weight:600;color:#fff;text-align:left;">항목명</th>
  <th style="padding:11px 14px;font-size:12px;font-weight:600;color:#fff;text-align:right;width:110px;">단가</th>
  <th style="padding:11px 14px;font-size:12px;font-weight:600;color:#fff;text-align:center;width:54px;">수량</th>
  <th style="padding:11px 14px;font-size:12px;font-weight:600;color:#fff;text-align:right;width:120px;">금액</th>
</tr></thead>
<tbody>${rows}</tbody></table>
</div>
<div style="padding:20px 44px 36px;display:flex;justify-content:flex-end;">
<div style="min-width:280px;">
  <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e0e8f0;font-size:13px;color:#64748b;"><span>공급가액</span><span>${subTotal.toLocaleString()}</span></div>
  <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e0e8f0;font-size:13px;color:#64748b;"><span>부가세 (10%)</span><span>${vat.toLocaleString()}</span></div>
  <div style="background:#1e3a5f;border-radius:8px;padding:12px 16px;margin-top:8px;display:flex;justify-content:space-between;align-items:center;">
    <span style="font-size:13px;color:#93c5fd;font-weight:600;">합계 (VAT 포함)</span>
    <span style="font-size:18px;color:#fff;font-weight:700;">${finalAmount.toLocaleString()}</span>
  </div>
</div></div>
<div style="padding:14px 44px;background:#f0f4f8;font-size:11px;color:#7090a0;border-top:1px solid #d0dce8;line-height:1.7;">
  상기 금액으로 견적 드립니다. 본 견적서의 유효기간은 발행일로부터 30일입니다.
</div>
</div></body></html>`
}

// 비교견적서 모달
function ComparisonQuotesModal({ items, finalAmount, meta, clientName, onClose }) {
  const [activeComp, setActiveComp] = useState(0)
  const [companies, setCompanies] = useState(getCompCompanies)
  const [showSettings, setShowSettings] = useState(false)

  const comp = companies[activeComp]
  const compItems = genCompItems(items, finalAmount, comp.multiplier, activeComp)
  const compFinal = Math.floor((finalAmount * comp.multiplier) / 10000) * 10000
  const compSub = compItems.reduce((s, it) => s + it.price * (it.qty || 1) * (it.day || 1), 0)

  const qdStr = (() => {
    const d = new Date(meta.quote_date)
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}.`
  })()

  const handlePrint = () => {
    const html = activeComp === 0
      ? buildCompHtmlA(comp, compItems, meta, clientName, qdStr, compSub, compFinal)
      : buildCompHtmlB(comp, compItems, meta, clientName, qdStr, compSub, compFinal)
    const win = window.open('', '_blank', 'width=900,height=800')
    win.document.write(html)
    win.document.close()
    setTimeout(() => win.print(), 500)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', flexDirection: 'column', zIndex: 2000 }}>
      {/* 헤더 */}
      <div style={{ background: '#0f172a', padding: '10px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 600 }}>📊 비교견적서 생성</span>
          <span style={{ color: '#475569', fontSize: 12 }}>루나모 기준 +{Math.round((comp.multiplier - 1) * 100)}% 수준</span>
          <div style={{ display: 'flex', gap: 4, marginLeft: 4 }}>
            {companies.map((c, i) => (
              <button key={i} onClick={() => setActiveComp(i)} style={{
                padding: '5px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12,
                background: activeComp === i ? '#7c3aed' : '#334155', color: '#fff',
                fontWeight: activeComp === i ? 700 : 400,
              }}>
                업체 {c.id} (+{Math.round((c.multiplier - 1) * 100)}%)
              </button>
            ))}
          </div>
          <span style={{ color: '#64748b', fontSize: 12, marginLeft: 4 }}>{comp.name}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ color: '#7c3aed', fontSize: 13, fontWeight: 700, alignSelf: 'center' }}>
            최종금액 {compFinal.toLocaleString('ko-KR')}원
          </span>
          <button onClick={() => setShowSettings(true)} style={{ ...btnPrimary, background: '#334155' }}>⚙️ 업체 설정</button>
          <button onClick={handlePrint} style={{ ...btnPrimary, background: '#475569' }}>🖨️ 인쇄 / PDF 저장</button>
          <button onClick={onClose} style={{ padding: '7px 18px', borderRadius: 8, border: '1px solid #475569', background: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: 13 }}>닫기</button>
        </div>
      </div>

      {/* 미리보기 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '32px', display: 'flex', justifyContent: 'center' }}>
        {activeComp === 0
          ? <CompPreviewA comp={comp} items={compItems} meta={meta} clientName={clientName} qdStr={qdStr} finalAmount={compFinal} subTotal={compSub} />
          : <CompPreviewB comp={comp} items={compItems} meta={meta} clientName={clientName} qdStr={qdStr} finalAmount={compFinal} subTotal={compSub} />
        }
      </div>

      {showSettings && (
        <CompanySettingsModal
          onClose={() => setShowSettings(false)}
          onSave={(data) => { setCompCompanies(data); setCompanies(data); setShowSettings(false) }}
        />
      )}
    </div>
  )
}

// 비교업체 설정 모달
function CompanySettingsModal({ onClose, onSave }) {
  const [comps, setComps] = useState(getCompCompanies)
  const update = (i, field, val) =>
    setComps(prev => prev.map((c, ci) => ci === i ? { ...c, [field]: val } : c))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: 560, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', marginBottom: 24 }}>⚙️ 비교업체 정보 설정</h3>
        {comps.map((comp, i) => (
          <div key={i} style={{ marginBottom: 28, paddingBottom: 28, borderBottom: i < comps.length - 1 ? '1px solid #e2e8f0' : undefined }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#7c3aed', marginBottom: 14 }}>
              업체 {comp.id} — 루나모 대비 +{Math.round((comp.multiplier - 1) * 100)}%
            </div>
            {[
              ['업체명 *', 'name'],
              ['사업자번호', 'bizno'],
              ['대표자', 'rep'],
              ['주소', 'address'],
              ['계좌번호', 'bank'],
            ].map(([label, field]) => (
              <div key={field} style={{ marginBottom: 10 }}>
                <label style={labelStyle}>{label}</label>
                <input
                  value={comp[field] || ''}
                  onChange={e => update(i, field, e.target.value)}
                  style={inputStyle}
                />
              </div>
            ))}
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={btnCancel}>취소</button>
          <button onClick={() => onSave(comps)} style={btnPrimary}>저장</button>
        </div>
      </div>
    </div>
  )
}

// ── 견적서 이메일 발송 모달 ────────────────────────────────────────────────
function SendQuoteEmailModal({ quote, clientName, clientEmail, subTotal, finalAmount, items, onClose }) {
  const DEFAULT_MSG = `안녕하세요, 루나모입니다.\n\n요청하신 프로젝트 견적서를 보내드립니다.\n검토 후 궁금하신 점이 있으시면 언제든지 연락 주세요.\n\n감사합니다.`
  const [to, setTo] = useState(clientEmail)
  const [subject, setSubject] = useState(`[LUNAMO] 견적서 - ${quote.project_title}`)
  const [message, setMessage] = useState(DEFAULT_MSG)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleSend = async () => {
    if (!to) return setError('받는 사람 이메일을 입력해주세요.')
    setSending(true); setError('')
    try {
      const res = await fetch('/api/send-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to, subject, message,
          quote: {
            project_title: quote.project_title,
            client_name: clientName,
            quote_date: quote.quote_date,
            sub_total: subTotal,
            final_amount: finalAmount,
            items,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '전송 실패')
      setDone(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: 480, padding: 28, boxShadow: '0 24px 80px rgba(0,0,0,0.3)' }}>
        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#059669', marginBottom: 8 }}>이메일이 발송되었습니다</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>{to}</div>
            <button onClick={onClose} style={{ ...btnPrimary, background: '#059669' }}>닫기</button>
          </div>
        ) : (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 20 }}>✉️ 견적서 이메일 발송</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>받는 사람 이메일 *</label>
                <input value={to} onChange={e => setTo(e.target.value)} style={inputStyle} placeholder="client@example.com" />
              </div>
              <div>
                <label style={labelStyle}>제목</label>
                <input value={subject} onChange={e => setSubject(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>메시지</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)}
                  style={{ ...inputStyle, height: 130, resize: 'vertical', lineHeight: 1.6 }} />
              </div>
              {error && <div style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: 8 }}>{error}</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button onClick={onClose} style={btnCancel}>취소</button>
              <button onClick={handleSend} disabled={sending} style={{ ...btnPrimary, background: '#059669', opacity: sending ? 0.7 : 1 }}>
                {sending ? '발송 중...' : '발송'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────
const tdStyle    = { padding: '11px 16px', fontSize: 13, color: '#374151' }
const thStyle    = { padding: '9px 10px', fontSize: 12, color: '#64748b', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap', borderBottom: '1px solid #e2e8f0' }
const btnPrimary = { padding: '9px 20px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }
const btnCancel  = { padding: '9px 20px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 14, color: '#64748b' }
const btnSmall   = { padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#475569' }
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 6 }
const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, color: '#1e293b', outline: 'none', background: '#fff', boxSizing: 'border-box' }
const cellInput  = { width: '100%', padding: '5px 6px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, textAlign: 'center', outline: 'none', boxSizing: 'border-box' }
