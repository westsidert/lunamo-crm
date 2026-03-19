import { useState, useEffect } from 'react'
import { getTransactions, createTransaction, createTransactions, updateTransaction, deleteTransaction, getClients, getProjects } from '../lib/api'
import { formatKRW, formatDate, calcVat } from '../lib/utils'
import Modal, { FormRow, Input, Select, Textarea, FormActions } from '../components/Modal'
import { getCrew } from '../lib/crew'

const EMPTY = {
  type: '매출', transaction_date: new Date().toISOString().slice(0, 10),
  item: '', client_id: '', project_id: '',
  supply_amount: '', vat: '', withholding_tax: '',
  invoice_issued: false, payment_status: '미수금', memo: '',
}

const TYPE_STYLE = {
  '매출':     { bg: '#eff6ff', color: '#2563eb' },
  '매입':     { bg: '#fffbeb', color: '#d97706' },
  '외주인건비': { bg: '#f5f3ff', color: '#7c3aed' },
}

const calcWithholding = (amount) => Math.round((Number(amount) || 0) * 0.033)

export default function Transactions() {
  const [transactions, setTransactions] = useState([])
  const [clients, setClients] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [filter, setFilter] = useState({ type: '', client_id: '', month: '' })

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [tx, cl, pr] = await Promise.all([getTransactions(), getClients(), getProjects()])
      setTransactions(tx)
      setClients(cl)
      setProjects(pr)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  // 거래 데이터에서 존재하는 연월 목록 추출 (최신순)
  const monthOptions = [...new Set(transactions.map(tx => tx.transaction_date?.slice(0, 7)).filter(Boolean))]
    .sort().reverse()

  const filtered = transactions.filter(tx => {
    if (filter.type && tx.type !== filter.type) return false
    if (filter.client_id && tx.client_id !== filter.client_id) return false
    if (filter.month && !tx.transaction_date?.startsWith(filter.month)) return false
    return true
  })

  const totalSales    = filtered.filter(t => t.type === '매출').reduce((s, t) => s + Number(t.total_amount), 0)
  const totalPurchase = filtered.filter(t => t.type === '매입').reduce((s, t) => s + Number(t.total_amount), 0)
  const totalLabor    = filtered.filter(t => t.type === '외주인건비').reduce((s, t) => s + Number(t.supply_amount), 0)
  const profit        = totalSales - totalPurchase - totalLabor

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>거래 내역</h1>
          <p style={{ color: '#64748b', marginTop: 4, fontSize: 13 }}>매출 · 매입 · 외주인건비 관리</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setModal('labor-batch')} style={{ ...btnPrimary, background: '#7c3aed' }}>👥 외주인건비 일괄입력</button>
          <button onClick={() => setModal('create')} style={btnPrimary}>+ 거래 등록</button>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <SumCard label="매출 합계"      value={totalSales}    color="#2563eb" />
        <SumCard label="매입 합계"      value={totalPurchase} color="#d97706" />
        <SumCard label="외주인건비 합계" value={totalLabor}    color="#7c3aed" />
        <SumCard label="순이익"         value={profit}        color={profit >= 0 ? '#059669' : '#dc2626'} />
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={filter.month} onChange={e => setFilter(f => ({ ...f, month: e.target.value }))} style={selStyle}>
          <option value="">전체 월</option>
          {monthOptions.map(m => {
            const [y, mo] = m.split('-')
            return <option key={m} value={m}>{y}년 {parseInt(mo)}월</option>
          })}
        </select>
        <select value={filter.type} onChange={e => setFilter(f => ({ ...f, type: e.target.value }))} style={selStyle}>
          <option value="">전체 유형</option>
          <option>매출</option>
          <option>매입</option>
          <option>외주인건비</option>
        </select>
        <select value={filter.client_id} onChange={e => setFilter(f => ({ ...f, client_id: e.target.value }))} style={selStyle}>
          <option value="">전체 거래처</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {(filter.type || filter.client_id || filter.month) && (
          <button onClick={() => setFilter({ type: '', client_id: '', month: '' })} style={{ ...selStyle, cursor: 'pointer' }}>
            초기화
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              {['유형','날짜','거래처/프리랜서','프로젝트','항목','금액','세금','실지급/합계','증빙','상태','메모',''].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 12, color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={12} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>불러오는 중...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={12} style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>거래 내역이 없습니다</td></tr>
            ) : filtered.map(tx => {
              const isLabor = tx.type === '외주인건비'
              const ts = TYPE_STYLE[tx.type] || TYPE_STYLE['매입']
              const netPay = isLabor ? Number(tx.supply_amount) - Number(tx.withholding_tax || 0) : null
              return (
                <tr key={tx.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: ts.bg, color: ts.color }}>
                      {tx.type}
                    </span>
                  </td>
                  <td style={tdStyle}>{formatDate(tx.transaction_date)}</td>
                  <td style={tdStyle}>{tx.clients?.name || '-'}</td>
                  <td style={tdStyle}>{tx.projects?.name || '-'}</td>
                  <td style={{ ...tdStyle, maxWidth: 160 }}>{tx.item}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{formatKRW(tx.supply_amount)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontSize: 12 }}>
                    {isLabor
                      ? <><span style={{ color: '#7c3aed' }}>-{formatKRW(tx.withholding_tax || 0)}</span><br/><span style={{ color: '#94a3b8', fontSize: 11 }}>원천세</span></>
                      : <><span style={{ color: '#64748b' }}>{formatKRW(tx.vat)}</span><br/><span style={{ color: '#94a3b8', fontSize: 11 }}>부가세</span></>
                    }
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                    {isLabor
                      ? <>{formatKRW(netPay)}<br/><span style={{ color: '#94a3b8', fontSize: 11, fontWeight: 400 }}>실지급액</span></>
                      : formatKRW(tx.total_amount)
                    }
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center', fontSize: 12 }}>
                    {isLabor
                      ? (tx.invoice_issued ? <span style={{ color: '#7c3aed', fontSize: 11 }}>원천세<br/>영수증</span> : '-')
                      : (tx.invoice_issued ? '✓' : '-')
                    }
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, ...paymentStyle(tx.payment_status) }}>
                      {tx.payment_status}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, maxWidth: 120, color: '#94a3b8', fontSize: 12 }}>{tx.memo || ''}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => setModal(tx)} style={btnSmall}>수정</button>
                      <button onClick={() => {
                        const { id, clients, projects: _p, total_amount, ...rest } = tx
                        setModal(rest)
                      }} style={{ ...btnSmall, color: '#0891b2', borderColor: '#a5f3fc' }}>복제</button>
                      <button onClick={() => handleDelete(tx.id)} style={{ ...btnSmall, color: '#ef4444' }}>삭제</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modal === 'labor-batch' && (
        <LaborBatchModal
          projects={projects}
          onClose={() => setModal(null)}
          onSave={handleBatchSave}
        />
      )}

      {modal && modal !== 'labor-batch' && (
        <TransactionModal
          tx={modal === 'create' ? EMPTY : modal}
          clients={clients}
          projects={projects}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )

  async function handleSave(data) {
    if (modal === 'create' || !modal.id) {
      const created = await createTransaction(data)
      setTransactions(prev => [created, ...prev])
    } else {
      const updated = await updateTransaction(modal.id, data)
      setTransactions(prev => prev.map(t => t.id === updated.id ? updated : t))
    }
    setModal(null)
  }

  async function handleBatchSave(txList) {
    const created = await createTransactions(txList)
    setTransactions(prev => [...[...created].reverse(), ...prev])
    setModal(null)
  }

  async function handleDelete(id) {
    if (!confirm('삭제하시겠습니까?')) return
    await deleteTransaction(id)
    setTransactions(prev => prev.filter(t => t.id !== id))
  }
}

function TransactionModal({ tx, clients, projects, onClose, onSave }) {
  const [form, setForm] = useState({ ...tx, withholding_tax: tx.withholding_tax ?? '' })
  const [loading, setLoading] = useState(false)
  const [inputMode, setInputMode] = useState('supply') // 'supply' | 'total'
  const [totalInput, setTotalInput] = useState('')
  const isLabor = form.type === '외주인건비'

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleTypeChange = (t) => {
    setInputMode('supply')
    setTotalInput('')
    setForm(f => ({
      ...f, type: t,
      payment_status: t === '매출' ? '미수금' : '미지급',
      supply_amount: '', vat: '', withholding_tax: '',
    }))
  }

  const handleAmountChange = (v) => {
    set('supply_amount', v)
    if (form.type === '외주인건비') {
      set('withholding_tax', calcWithholding(v))
    } else {
      set('vat', calcVat(Number(v) || 0))
    }
  }

  const handleTotalChange = (v) => {
    setTotalInput(v)
    const total = Number(v) || 0
    const supply = Math.round(total / 1.1)
    const vat = total - supply
    setForm(f => ({ ...f, supply_amount: supply, vat }))
  }

  const handleModeChange = (mode) => {
    setInputMode(mode)
    setTotalInput('')
    setForm(f => ({ ...f, supply_amount: '', vat: '' }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onSave({
        type: form.type,
        transaction_date: form.transaction_date,
        item: form.item,
        client_id: form.client_id || null,
        project_id: form.project_id || null,
        supply_amount: Number(form.supply_amount) || 0,
        vat: isLabor ? 0 : (Number(form.vat) || 0),
        withholding_tax: isLabor ? (Number(form.withholding_tax) || 0) : 0,
        invoice_issued: form.invoice_issued,
        payment_status: form.payment_status,
        memo: form.memo,
      })
    } catch (e) {
      alert('저장 실패: ' + e.message)
    }
    setLoading(false)
  }

  const supplyNum      = Number(form.supply_amount) || 0
  const withholdingNum = Number(form.withholding_tax) || 0
  const vatNum         = Number(form.vat) || 0
  const displayTotal   = isLabor ? supplyNum - withholdingNum : supplyNum + vatNum

  return (
    <Modal title={tx.id ? '거래 수정' : '거래 등록'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {/* 유형 토글 */}
        <FormRow label="거래 유형" required>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { key: '매출',      color: '#2563eb', bg: '#eff6ff' },
              { key: '매입',      color: '#d97706', bg: '#fffbeb' },
              { key: '외주인건비', color: '#7c3aed', bg: '#f5f3ff' },
            ].map(({ key, color, bg }) => (
              <button key={key} type="button" onClick={() => handleTypeChange(key)} style={{
                flex: 1, padding: '10px 6px', borderRadius: 8, border: '2px solid',
                borderColor: form.type === key ? color : '#e2e8f0',
                background: form.type === key ? bg : '#fff',
                color: form.type === key ? color : '#94a3b8',
                cursor: 'pointer', fontSize: 14, fontWeight: 700,
              }}>{key}</button>
            ))}
          </div>
        </FormRow>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormRow label="날짜" required>
            <Input type="date" value={form.transaction_date} onChange={e => set('transaction_date', e.target.value)} required />
          </FormRow>
          <FormRow label={isLabor ? '프리랜서 / 거래처' : '거래처'}>
            <Select value={form.client_id} onChange={e => set('client_id', e.target.value)}>
              <option value="">선택 안 함</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </FormRow>
        </div>

        <FormRow label={isLabor ? '작업 내용' : '항목'} required>
          <Input
            placeholder={isLabor ? '예) 편집 작업비 (홍길동)' : '예) 기업홍보영상 제작비'}
            value={form.item} onChange={e => set('item', e.target.value)} required />
        </FormRow>

        <FormRow label="프로젝트">
          <Select value={form.project_id} onChange={e => set('project_id', e.target.value)}>
            <option value="">선택 안 함</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </FormRow>

        {isLabor ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormRow label="지급액" required>
              <Input type="number" placeholder="1000000"
                value={form.supply_amount} onChange={e => handleAmountChange(e.target.value)} required />
            </FormRow>
            <FormRow label="원천세 (3.3%)">
              <Input type="number" value={form.withholding_tax}
                onChange={e => set('withholding_tax', e.target.value)} />
            </FormRow>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {[['supply', '공급가액으로 입력'], ['total', '합계금액으로 입력']].map(([mode, label]) => (
                <button key={mode} type="button" onClick={() => handleModeChange(mode)} style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1.5px solid',
                  borderColor: inputMode === mode ? '#2563eb' : '#e2e8f0',
                  background: inputMode === mode ? '#eff6ff' : '#fff',
                  color: inputMode === mode ? '#2563eb' : '#94a3b8',
                }}>{label}</button>
              ))}
            </div>
            {inputMode === 'supply' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormRow label="공급가액" required>
                  <Input type="number" placeholder="10000000"
                    value={form.supply_amount} onChange={e => handleAmountChange(e.target.value)} required />
                </FormRow>
                <FormRow label="부가세 (10%)">
                  <Input type="number" value={form.vat} onChange={e => set('vat', e.target.value)} />
                </FormRow>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormRow label="합계금액 (VAT 포함)" required>
                  <Input type="number" placeholder="11000000"
                    value={totalInput} onChange={e => handleTotalChange(e.target.value)} required />
                </FormRow>
                <FormRow label="공급가액 (자동)">
                  <Input type="number" value={form.supply_amount} readOnly
                    style={{ background: '#f8fafc', color: '#64748b' }} />
                </FormRow>
              </div>
            )}
          </>
        )}

        {/* 합계 / 실지급액 요약 */}
        <div style={{
          background: isLabor ? '#faf5ff' : '#f8fafc',
          border: `1px solid ${isLabor ? '#e9d5ff' : '#e2e8f0'}`,
          borderRadius: 10, padding: '14px 16px', marginBottom: 16,
        }}>
          {isLabor ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>지급액</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>{formatKRW(supplyNum)}원</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>원천세 (3.3%)</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#7c3aed' }}>-{formatKRW(withholdingNum)}원</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>실지급액</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>{formatKRW(displayTotal)}원</div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#64748b' }}>합계 (공급가액 + 부가세)</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{formatKRW(displayTotal)}원</span>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormRow label={isLabor ? '지급 상태' : '수금/지급 상태'}>
            <Select value={form.payment_status} onChange={e => set('payment_status', e.target.value)}>
              {form.type === '매출'
                ? ['미수금', '수금완료'].map(s => <option key={s}>{s}</option>)
                : ['미지급', '지급완료'].map(s => <option key={s}>{s}</option>)
              }
            </Select>
          </FormRow>
          <FormRow label={isLabor ? '원천세 영수증' : '세금계산서'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 0' }}>
              <input type="checkbox" id="invoice" checked={form.invoice_issued}
                onChange={e => set('invoice_issued', e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer' }} />
              <label htmlFor="invoice" style={{ fontSize: 14, color: '#475569', cursor: 'pointer' }}>
                {isLabor ? '발급 완료' : '발행 완료'}
              </label>
            </div>
          </FormRow>
        </div>

        <FormRow label="메모">
          <Textarea
            placeholder={isLabor ? '작업 내용, 계좌 정보 등' : '추가 메모'}
            value={form.memo} onChange={e => set('memo', e.target.value)} />
        </FormRow>

        <FormActions onClose={onClose} loading={loading} />
      </form>
    </Modal>
  )
}

// ── 외주인건비 일괄입력 모달 ─────────────────────────────────────────────────
function LaborBatchModal({ projects, onClose, onSave }) {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [projectId, setProjectId] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('지급완료')
  const [rows, setRows] = useState([mkRow()])
  const [loading, setLoading] = useState(false)
  const [crew, setCrew] = useState([])
  useEffect(() => { getCrew().then(setCrew).catch(console.error) }, [])

  function mkRow() {
    return { _id: Date.now() + Math.random(), name: '', item: '', amount: '', withholding: '', memo: '' }
  }

  const addRow = () => setRows(r => [...r, mkRow()])
  const removeRow = (id) => setRows(r => r.filter(row => row._id !== id))
  const updateRow = (id, field, val) => {
    setRows(r => r.map(row => {
      if (row._id !== id) return row
      const next = { ...row, [field]: val }
      if (field === 'amount') next.withholding = Math.round((Number(val) || 0) * 0.033).toString()
      return next
    }))
  }

  const totalAmount     = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const totalWithholding = rows.reduce((s, r) => s + (Number(r.withholding) || 0), 0)
  const totalNet        = totalAmount - totalWithholding
  const validCount      = rows.filter(r => r.name.trim() && Number(r.amount) > 0).length

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validRows = rows.filter(r => r.name.trim() && Number(r.amount) > 0)
    if (validRows.length === 0) { alert('최소 1명의 이름과 지급액을 입력해주세요.'); return }
    setLoading(true)
    try {
      const txList = validRows.map(r => ({
        type: '외주인건비',
        transaction_date: date,
        item: r.name + (r.item ? ` (${r.item})` : ''),
        client_id: null,
        project_id: projectId || null,
        supply_amount: Number(r.amount),
        vat: 0,
        withholding_tax: Number(r.withholding) || 0,
        invoice_issued: false,
        payment_status: paymentStatus,
        memo: r.memo || '',
      }))
      await onSave(txList)
    } catch (err) {
      alert('저장 실패: ' + err.message)
    }
    setLoading(false)
  }

  const colStyle = (align = 'left') => ({
    padding: '9px 10px', fontSize: 11, color: '#64748b', fontWeight: 600,
    textAlign: align, whiteSpace: 'nowrap', borderBottom: '1px solid #e2e8f0', background: '#f8fafc',
  })
  const cellPad = { padding: '6px 7px' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 900, maxHeight: '92vh', overflow: 'auto', boxShadow: '0 12px 48px rgba(0,0,0,0.2)' }}>

        {/* 헤더 */}
        <div style={{ padding: '22px 28px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ background: '#f5f3ff', color: '#7c3aed', padding: '3px 12px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>외주인건비</span>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>일괄 입력</h2>
            </div>
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 5 }}>날짜를 한 번 설정하고 여러 인력의 인건비를 한 번에 등록합니다</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8', padding: '4px 8px' }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px 28px 28px' }}>

          {/* 공통 설정 */}
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 160px', gap: 12, marginBottom: 20, padding: '16px 20px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <div>
              <label style={lbStyle}>날짜 *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inStyle} required />
            </div>
            <div>
              <label style={lbStyle}>프로젝트 연결</label>
              <select value={projectId} onChange={e => setProjectId(e.target.value)} style={inStyle}>
                <option value="">선택 안 함</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={lbStyle}>지급 상태</label>
              <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)} style={inStyle}>
                <option>미지급</option>
                <option>지급완료</option>
              </select>
            </div>
          </div>

          {/* 인력 테이블 */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={colStyle()}>이름</th>
                  <th style={colStyle()}>작업 내용</th>
                  <th style={{ ...colStyle('right'), minWidth: 110 }}>지급액</th>
                  <th style={{ ...colStyle('right'), minWidth: 110 }}>원천세 (3.3%)</th>
                  <th style={{ ...colStyle('right'), minWidth: 110 }}>실지급액</th>
                  <th style={colStyle()}>메모</th>
                  <th style={{ ...colStyle('center'), width: 36 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const net = (Number(row.amount) || 0) - (Number(row.withholding) || 0)
                  const rowBg = idx % 2 === 1 ? '#fafafa' : '#fff'
                  return (
                    <tr key={row._id} style={{ borderBottom: '1px solid #f1f5f9', background: rowBg }}>
                      <td style={{ ...cellPad, minWidth: 140 }}>
                        <input
                          list={`crew-dl-${row._id}`}
                          value={row.name}
                          onChange={e => updateRow(row._id, 'name', e.target.value)}
                          placeholder="이름 입력 또는 선택"
                          style={{ ...cellInput, minWidth: 120 }}
                        />
                        <datalist id={`crew-dl-${row._id}`}>
                          {crew.map(c => (
                            <option key={c.id} value={c.name}>
                              {c.role ? `[${c.role}]` : ''}
                            </option>
                          ))}
                        </datalist>
                      </td>
                      <td style={{ ...cellPad, minWidth: 160 }}>
                        <input
                          value={row.item}
                          onChange={e => updateRow(row._id, 'item', e.target.value)}
                          placeholder="편집 작업, 촬영 등"
                          style={cellInput}
                        />
                      </td>
                      <td style={{ ...cellPad }}>
                        <input
                          type="number"
                          value={row.amount}
                          onChange={e => updateRow(row._id, 'amount', e.target.value)}
                          placeholder="0"
                          style={{ ...cellInput, textAlign: 'right' }}
                        />
                      </td>
                      <td style={{ ...cellPad }}>
                        <input
                          type="number"
                          value={row.withholding}
                          onChange={e => updateRow(row._id, 'withholding', e.target.value)}
                          style={{ ...cellInput, textAlign: 'right', color: '#7c3aed' }}
                        />
                      </td>
                      <td style={{ ...cellPad, textAlign: 'right', fontWeight: 600, fontSize: 13, color: net > 0 ? '#0f172a' : '#cbd5e1', whiteSpace: 'nowrap', paddingRight: 14 }}>
                        {net > 0 ? net.toLocaleString('ko-KR') : '-'}
                      </td>
                      <td style={{ ...cellPad, minWidth: 120 }}>
                        <input
                          value={row.memo}
                          onChange={e => updateRow(row._id, 'memo', e.target.value)}
                          placeholder="메모"
                          style={cellInput}
                        />
                      </td>
                      <td style={{ ...cellPad, textAlign: 'center' }}>
                        {rows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeRow(row._id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 18, lineHeight: 1, padding: '2px 4px' }}
                          >×</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <button type="button" onClick={addRow} style={{ ...btnSmall, color: '#7c3aed', borderColor: '#c4b5fd', marginBottom: 20, padding: '6px 14px', fontSize: 13 }}>
            + 인력 추가
          </button>

          {/* 합계 요약 */}
          <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 10, padding: '14px 24px', marginBottom: 22, display: 'flex', gap: 0, justifyContent: 'flex-end' }}>
            {[
              [`${validCount}명 / 지급액 합계`, totalAmount.toLocaleString('ko-KR') + '원', '#0f172a'],
              ['원천세 합계', '−' + totalWithholding.toLocaleString('ko-KR') + '원', '#7c3aed'],
              ['실지급액 합계', totalNet.toLocaleString('ko-KR') + '원', '#0f172a'],
            ].map(([label, value, color], i) => (
              <div key={i} style={{ textAlign: 'center', paddingLeft: i > 0 ? 32 : 0, marginLeft: i > 0 ? 32 : 0, borderLeft: i > 0 ? '1px solid #e9d5ff' : undefined }}>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: i === 2 ? 18 : 15, fontWeight: i === 2 ? 700 : 600, color }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={onClose} style={btnCancel}>취소</button>
            <button type="submit" disabled={loading} style={{ ...btnPrimary, background: '#7c3aed', opacity: loading ? 0.7 : 1 }}>
              {loading ? '저장 중...' : `일괄 저장 (${validCount}명)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const lbStyle = { display: 'block', fontSize: 12, fontWeight: 500, color: '#64748b', marginBottom: 5 }
const inStyle  = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, color: '#1e293b', outline: 'none', background: '#fff', boxSizing: 'border-box' }
const cellInput = { width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1e293b' }
const btnCancel = { padding: '9px 20px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 14, color: '#64748b' }

function SumCard({ label, value, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', border: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color, whiteSpace: 'nowrap' }}>{formatKRW(value)}원</div>
    </div>
  )
}

const paymentStyle = (s) => {
  const map = {
    '미수금':  { background: '#fef2f2', color: '#dc2626' },
    '수금완료': { background: '#f0fdf4', color: '#16a34a' },
    '미지급':  { background: '#fff7ed', color: '#ea580c' },
    '지급완료': { background: '#f1f5f9', color: '#475569' },
  }
  return map[s] || {}
}

const tdStyle    = { padding: '11px 14px', fontSize: 13, color: '#374151' }
const selStyle   = { padding: '7px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, color: '#475569', background: '#fff', cursor: 'pointer' }
const btnPrimary = { padding: '9px 20px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }
const btnSmall   = { padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#475569' }
