import { useState, useEffect } from 'react'
import { getFixedExpenses, createFixedExpense, updateFixedExpense, deleteFixedExpense } from '../lib/api'
import { formatKRW, thisMonth, thisYear, MONTHS } from '../lib/utils'

const CATEGORIES  = ['임대료', '소프트웨어', '통신비', '인건비', '마케팅', '기타']
const PAY_METHODS = ['자동이체', '법인카드', '계좌이체', '기타']
const CYCLES      = ['월간', '분기', '연간']

// 결제 주기별 월 환산 제수
const CYCLE_DIV = { '월간': 1, '분기': 3, '연간': 12 }
// 결제 주기 표기
const CYCLE_LABEL = { '월간': '월', '분기': '분기', '연간': '년' }

// amount 는 해당 주기의 실제 결제 금액, monthlyAmt 는 월 환산 금액
const monthlyAmt = (fe) => Math.round(fe.amount / (CYCLE_DIV[fe.billing_cycle] ?? 1))

const CAT_COLOR = {
  '임대료': '#2563eb', '소프트웨어': '#7c3aed', '통신비': '#0891b2',
  '인건비': '#d97706', '마케팅': '#059669', '기타': '#64748b',
}
const CAT_BG = {
  '임대료': '#eff6ff', '소프트웨어': '#f5f3ff', '통신비': '#ecfeff',
  '인건비': '#fffbeb', '마케팅': '#f0fdf4', '기타': '#f1f5f9',
}

const today = new Date()

export default function FixedExpenses() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'add' | {item object}
  const [form, setForm] = useState({})
  const [viewYear, setViewYear] = useState(thisYear())
  const [viewMonth, setViewMonth] = useState(thisMonth())
  const [filterActive, setFilterActive] = useState('all') // 'all' | 'active' | 'inactive'

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try { setItems(await getFixedExpenses()) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const openAdd = () => {
    const y = thisYear()
    const m = String(thisMonth()).padStart(2, '0')
    setForm({
      name: '', amount: '', billing_cycle: '월간', billing_day: 25,
      category: '소프트웨어', payment_method: '자동이체',
      start_date: `${y}-${m}-01`, end_date: '', is_active: true,
    })
    setModal('add')
  }

  const openEdit = (item) => {
    setForm({ ...item, end_date: item.end_date || '' })
    setModal(item)
  }

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const save = async () => {
    if (!form.name.trim()) return alert('항목명을 입력하세요.')
    if (!form.amount || isNaN(Number(form.amount))) return alert('금액을 입력하세요.')
    const payload = {
      name: form.name.trim(),
      amount: parseInt(form.amount),
      billing_cycle: form.billing_cycle || '월간',
      billing_day: parseInt(form.billing_day) || 1,
      category: form.category,
      payment_method: form.payment_method || null,
      start_date: form.start_date,
      end_date: form.end_date || null,
      is_active: form.is_active !== false,
    }
    try {
      if (modal === 'add') {
        const created = await createFixedExpense(payload)
        setItems(prev => [...prev, created])
      } else {
        const updated = await updateFixedExpense(modal.id, payload)
        setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
      }
      setModal(null)
    } catch (e) {
      console.error(e)
      alert('저장 실패: ' + e.message)
    }
  }

  const remove = async (id) => {
    if (!confirm('이 항목을 삭제하시겠습니까?')) return
    try {
      await deleteFixedExpense(id)
      setItems(prev => prev.filter(i => i.id !== id))
    } catch (e) { console.error(e) }
  }

  // 선택 월에 활성인 항목 계산
  const firstOfMonth = `${viewYear}-${String(viewMonth).padStart(2, '0')}-01`
  const lastOfMonth  = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${new Date(viewYear, viewMonth, 0).getDate()}`
  const activeThisMonth = items.filter(fe =>
    fe.is_active &&
    fe.start_date <= lastOfMonth &&
    (!fe.end_date || fe.end_date >= firstOfMonth)
  )
  const monthlyTotal  = activeThisMonth.reduce((s, fe) => s + monthlyAmt(fe), 0)
  const activeCount   = items.filter(i => i.is_active).length
  const yearlyTotal   = items.filter(i => i.is_active).reduce((s, i) => s + monthlyAmt(i) * 12, 0)

  // 카테고리별 월 합계
  const catBreakdown = CATEGORIES.map(cat => ({
    cat,
    total: activeThisMonth.filter(i => i.category === cat).reduce((s, i) => s + monthlyAmt(i), 0),
    count: activeThisMonth.filter(i => i.category === cat).length,
  })).filter(c => c.count > 0)

  // 다음 결제가 오늘 기준 가장 가까운 항목 (활성만)
  const thisDay = today.getDate()
  const upcomingItems = activeThisMonth
    .map(fe => ({
      ...fe,
      daysLeft: fe.billing_day >= thisDay ? fe.billing_day - thisDay : (new Date(viewYear, viewMonth, 0).getDate() - thisDay) + fe.billing_day,
    }))
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 3)

  const displayItems = items.filter(fe => {
    if (filterActive === 'active') return fe.is_active
    if (filterActive === 'inactive') return !fe.is_active
    return true
  })

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, width: '100%' }}>

      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>고정비 관리</h1>
          <p style={{ color: '#64748b', marginTop: 4, fontSize: 13 }}>구독료, 임대료 등 매달 나가는 고정 비용</p>
        </div>
        <button onClick={openAdd} style={{
          background: '#0f172a', color: '#fff', border: 'none', borderRadius: 10,
          padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>+ 항목 추가</button>
      </div>

      {/* 통계 카드 3개 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>

        {/* 월 고정비 */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>월 고정비 합계</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <select value={viewYear} onChange={e => setViewYear(Number(e.target.value))} style={miniSel}>
                {[2024, 2025, 2026].map(y => <option key={y}>{y}</option>)}
              </select>
              <select value={viewMonth} onChange={e => setViewMonth(Number(e.target.value))} style={miniSel}>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#dc2626' }}>{formatKRW(monthlyTotal)}원</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>{activeThisMonth.length}개 항목 활성</div>
          {catBreakdown.length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {catBreakdown.map(c => (
                <span key={c.cat} style={{
                  background: CAT_BG[c.cat] || '#f1f5f9', color: CAT_COLOR[c.cat] || '#64748b',
                  borderRadius: 6, padding: '2px 7px', fontSize: 11, fontWeight: 600,
                }}>{c.cat} {formatKRW(c.total)}원</span>
              ))}
            </div>
          )}
        </div>

        {/* 활성 항목 */}
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500, marginBottom: 10 }}>활성 항목</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a' }}>{activeCount}개</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>전체 {items.length}개 중</div>
          {upcomingItems.length > 0 && (
            <div style={{ marginTop: 12, borderTop: '1px dashed #f1f5f9', paddingTop: 10 }}>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>다음 결제 예정</div>
              {upcomingItems.map(fe => (
                <div key={fe.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569', marginBottom: 3 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>{fe.name}</span>
                  <span style={{ color: fe.daysLeft <= 3 ? '#dc2626' : '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {fe.daysLeft === 0 ? '오늘' : `${fe.daysLeft}일 후`} ({fe.billing_day}일)
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 연간 예상 */}
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500, marginBottom: 10 }}>연간 예상 고정비</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#7c3aed' }}>{formatKRW(yearlyTotal)}원</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>활성 항목 × 12개월</div>
          {activeCount > 0 && (
            <div style={{ marginTop: 12, borderTop: '1px dashed #f1f5f9', paddingTop: 10 }}>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>월 평균</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#7c3aed' }}>
                {formatKRW(Math.round(yearlyTotal / 12))}원
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 테이블 헤더 */}
      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>항목 목록</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {[['all', '전체'], ['active', '활성'], ['inactive', '비활성']].map(([v, l]) => (
              <button key={v} onClick={() => setFilterActive(v)} style={{
                padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                background: filterActive === v ? '#0f172a' : '#f1f5f9',
                color: filterActive === v ? '#fff' : '#64748b',
              }}>{l}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>불러오는 중...</div>
        ) : displayItems.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>💸</div>
            <div style={{ fontSize: 14 }}>등록된 고정비 항목이 없습니다</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>+ 항목 추가 버튼으로 첫 항목을 등록해보세요</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #f1f5f9' }}>
                {['항목명', '카테고리', '결제금액', '월 환산', '결제일', '결제수단', '시작일', '종료일', '상태', ''].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#94a3b8', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayItems.map((fe, i) => (
                <tr key={fe.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 ? '#fafafa' : '#fff' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>{fe.name}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      background: CAT_BG[fe.category] || '#f1f5f9',
                      color: CAT_COLOR[fe.category] || '#64748b',
                      borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600,
                    }}>{fe.category}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 700, color: '#dc2626' }}>{formatKRW(fe.amount)}원</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>/ {CYCLE_LABEL[fe.billing_cycle] || '월'}</div>
                  </td>
                  <td style={{ padding: '12px 16px', color: fe.billing_cycle !== '월간' ? '#7c3aed' : '#94a3b8', fontWeight: fe.billing_cycle !== '월간' ? 600 : 400, fontSize: 12 }}>
                    {fe.billing_cycle !== '월간' ? `≈ ${formatKRW(monthlyAmt(fe))}원/월` : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#475569' }}>매월 {fe.billing_day}일</td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>{fe.payment_method || '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>{fe.start_date}</td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>{fe.end_date || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      background: fe.is_active ? '#f0fdf4' : '#f8fafc',
                      color: fe.is_active ? '#059669' : '#94a3b8',
                      borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600,
                    }}>{fe.is_active ? '활성' : '비활성'}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEdit(fe)} style={btnSmStyle('#2563eb')}>수정</button>
                      <button onClick={() => remove(fe.id)} style={btnSmStyle('#dc2626')}>삭제</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 모달 */}
      {modal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
          <div style={{ background: '#fff', borderRadius: 16, width: 540, padding: 28, boxShadow: '0 24px 80px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: '#0f172a' }}>
              {modal === 'add' ? '고정비 항목 추가' : '고정비 항목 수정'}
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>항목명 *</label>
                <input value={form.name || ''} onChange={e => f('name', e.target.value)} style={inp} placeholder="예: Adobe Creative Cloud" />
              </div>
              <div>
                <label style={lbl}>카테고리 *</label>
                <select value={form.category || ''} onChange={e => f('category', e.target.value)} style={inp}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>결제 주기 *</label>
                <select value={form.billing_cycle || '월간'} onChange={e => f('billing_cycle', e.target.value)} style={inp}>
                  {CYCLES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>
                  결제 금액 (원) * &nbsp;
                  <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>
                    {form.billing_cycle && form.billing_cycle !== '월간' && form.amount
                      ? `→ 월 환산 ≈ ${formatKRW(Math.round(Number(form.amount) / (CYCLE_DIV[form.billing_cycle] ?? 1)))}원/월`
                      : form.billing_cycle === '연간' ? '연간 총액 입력 시 자동 월 환산' : form.billing_cycle === '분기' ? '분기 총액 입력 시 자동 월 환산' : ''}
                  </span>
                </label>
                <input type="number" value={form.amount || ''} onChange={e => f('amount', e.target.value)} style={inp}
                  placeholder={form.billing_cycle === '연간' ? '연간 총액 (예: 1200000)' : form.billing_cycle === '분기' ? '분기 총액 (예: 300000)' : '월 금액 (예: 100000)'} />
              </div>
              <div>
                <label style={lbl}>결제일 (매월 몇 일)</label>
                <input type="number" min={1} max={31} value={form.billing_day || ''} onChange={e => f('billing_day', e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>결제 수단</label>
                <select value={form.payment_method || ''} onChange={e => f('payment_method', e.target.value)} style={inp}>
                  <option value="">선택 안함</option>
                  {PAY_METHODS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>시작일 *</label>
                <input type="date" value={form.start_date || ''} onChange={e => f('start_date', e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>종료일 (없으면 빈칸)</label>
                <input type="date" value={form.end_date || ''} onChange={e => f('end_date', e.target.value)} style={inp} />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4 }}>
                <input type="checkbox" id="chkActive" checked={form.is_active !== false} onChange={e => f('is_active', e.target.checked)} style={{ cursor: 'pointer', width: 15, height: 15 }} />
                <label htmlFor="chkActive" style={{ fontSize: 13, color: '#475569', cursor: 'pointer' }}>활성 (이번 달부터 고정비에 포함)</label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22 }}>
              <button onClick={() => setModal(null)} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13 }}>취소</button>
              <button onClick={save} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#0f172a', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const cardStyle = { background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid #e2e8f0' }
const miniSel   = { padding: '3px 6px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 11, color: '#475569', cursor: 'pointer' }
const lbl       = { fontSize: 12, fontWeight: 500, color: '#64748b', display: 'block', marginBottom: 5 }
const inp       = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, color: '#0f172a', boxSizing: 'border-box', outline: 'none' }
const btnSmStyle = (color) => ({ padding: '4px 10px', borderRadius: 6, border: `1px solid ${color}`, background: '#fff', color, cursor: 'pointer', fontSize: 11, fontWeight: 600 })
