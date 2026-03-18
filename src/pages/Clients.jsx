import { useState, useEffect } from 'react'
import { getClients, createClient, updateClient, deleteClient, getTransactions } from '../lib/api'
import { formatKRW } from '../lib/utils'
import Modal, { FormRow, Input, Textarea, FormActions } from '../components/Modal'

const EMPTY = { name: '', contact_person: '', phone: '', email: '', address: '', notes: '' }

export default function Clients() {
  const [clients, setClients] = useState([])
  const [transactions, setTransactions] = useState([])
  const [modal, setModal] = useState(null)
  const [historyClient, setHistoryClient] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [salesYear, setSalesYear] = useState('전체')

  const yearOptions = (() => {
    const years = [...new Set(transactions.map(t => t.transaction_date?.slice(0, 4)).filter(Boolean))].sort((a, b) => b - a)
    return ['전체', ...years]
  })()

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [cl, tx] = await Promise.all([getClients(), getTransactions()])
      setClients(cl)
      setTransactions(tx)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const getSalesForClient = (clientId) => {
    return transactions
      .filter(t => t.client_id === clientId && t.type === '매출' && (salesYear === '전체' || t.transaction_date?.startsWith(salesYear)))
      .reduce((s, t) => s + Number(t.total_amount), 0)
  }

  const getTxCountForClient = (clientId) => {
    return transactions
      .filter(t => t.client_id === clientId && (salesYear === '전체' || t.transaction_date?.startsWith(salesYear)))
      .length
  }

  const filtered = clients.filter(c =>
    c.name.includes(search) || c.contact_person?.includes(search) || c.phone?.includes(search)
  )

  const handleSave = async (data) => {
    if (modal === 'create') {
      const created = await createClient(data)
      setClients(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
    } else {
      const updated = await updateClient(modal.id, data)
      setClients(prev => prev.map(c => c.id === updated.id ? updated : c))
    }
    setModal(null)
  }

  const handleDelete = async (id) => {
    if (!confirm('거래처를 삭제하시겠습니까?\n관련 거래의 거래처 정보가 초기화됩니다.')) return
    await deleteClient(id)
    setClients(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>거래처 관리</h1>
          <p style={{ color: '#64748b', marginTop: 4, fontSize: 13 }}>{clients.length}개 거래처</p>
        </div>
        <button onClick={() => setModal('create')} style={btnPrimary}>+ 거래처 추가</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          placeholder="거래처명, 담당자, 연락처 검색..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: '1 1 280px', maxWidth: 400, padding: '9px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 14, background: '#fff' }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {['전체', ...(() => [...new Set(transactions.map(t => t.transaction_date?.slice(0,4)).filter(Boolean))].sort((a,b)=>b-a))()].map(y => (
            <button key={y} onClick={() => setSalesYear(y)} style={{
              padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: salesYear === y ? 700 : 400, cursor: 'pointer',
              background: salesYear === y ? '#2563eb' : '#fff',
              color: salesYear === y ? '#fff' : '#64748b',
              border: `1px solid ${salesYear === y ? '#2563eb' : '#e2e8f0'}`
            }}>{y === '전체' ? '전체' : `${y}년`}</button>
          ))}
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead style={{ background: '#f8fafc' }}>
            <tr>
              {['거래처명', '담당자', '연락처', '이메일', '주소', salesYear === '전체' ? '누적 매출' : `${salesYear}년 매출`, salesYear === '전체' ? '거래 건수' : `${salesYear}년 건수`, ''].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, color: '#94a3b8', fontWeight: 600, borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>불러오는 중...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>거래처가 없습니다</td></tr>
            ) : filtered.map((c, i) => (
              <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 ? '#fafafa' : '#fff' }}>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>
                  {c.name}
                  {c.notes && <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400, marginTop: 2 }}>{c.notes}</div>}
                </td>
                <td style={{ padding: '12px 16px', color: '#374151' }}>{c.contact_person || '—'}</td>
                <td style={{ padding: '12px 16px', color: '#374151', whiteSpace: 'nowrap' }}>{c.phone || '—'}</td>
                <td style={{ padding: '12px 16px', color: '#374151' }}>{c.email || '—'}</td>
                <td style={{ padding: '12px 16px', color: '#374151', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.address || '—'}</td>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: '#2563eb', whiteSpace: 'nowrap', textAlign: 'right' }}>{formatKRW(getSalesForClient(c.id))}원</td>
                <td style={{ padding: '12px 16px', color: '#475569', textAlign: 'center' }}>{getTxCountForClient(c.id)}건</td>
                <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setHistoryClient(c)} style={{ ...btnSmall, color: '#2563eb', borderColor: '#bfdbfe' }}>거래내역</button>
                    <button onClick={() => setModal(c)} style={btnSmall}>수정</button>
                    <button onClick={() => handleDelete(c.id)} style={{ ...btnSmall, color: '#ef4444' }}>삭제</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <ClientModal
          client={modal === 'create' ? EMPTY : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
      {historyClient && (
        <ClientHistoryModal
          client={historyClient}
          transactions={transactions.filter(t => t.client_id === historyClient.id)}
          onClose={() => setHistoryClient(null)}
        />
      )}
    </div>
  )
}

function ClientModal({ client, onClose, onSave }) {
  const [form, setForm] = useState({ ...client })
  const [loading, setLoading] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try { await onSave(form) } catch (e) { alert('저장 실패: ' + e.message) }
    setLoading(false)
  }

  return (
    <Modal title={client.id ? '거래처 수정' : '거래처 추가'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <FormRow label="거래처명" required>
          <Input placeholder="(주)루나모" value={form.name} onChange={e => set('name', e.target.value)} required />
        </FormRow>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormRow label="담당자">
            <Input placeholder="홍길동" value={form.contact_person || ''} onChange={e => set('contact_person', e.target.value)} />
          </FormRow>
          <FormRow label="연락처">
            <Input placeholder="010-0000-0000" value={form.phone || ''} onChange={e => set('phone', e.target.value)} />
          </FormRow>
        </div>
        <FormRow label="이메일">
          <Input type="email" placeholder="email@company.com" value={form.email || ''} onChange={e => set('email', e.target.value)} />
        </FormRow>
        <FormRow label="주소">
          <Input placeholder="서울시 강남구..." value={form.address || ''} onChange={e => set('address', e.target.value)} />
        </FormRow>
        <FormRow label="메모">
          <Textarea placeholder="특이사항, 계약 조건 등" value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
        </FormRow>
        <FormActions onClose={onClose} loading={loading} />
      </form>
    </Modal>
  )
}

const TYPE_COLOR = { '매출': '#2563eb', '매입': '#d97706', '외주인건비': '#7c3aed' }
const TYPE_BG    = { '매출': '#eff6ff', '매입': '#fffbeb', '외주인건비': '#f5f3ff' }

function ClientHistoryModal({ client, transactions, onClose }) {
  const sales    = transactions.filter(t => t.type === '매출').reduce((s, t) => s + Number(t.total_amount), 0)
  const purchase = transactions.filter(t => t.type === '매입').reduce((s, t) => s + Number(t.total_amount), 0)
  const sorted   = [...transactions].sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 720, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>{client.name} 거래 내역</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>총 {transactions.length}건</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 16, padding: '16px 24px', borderBottom: '1px solid #f8fafc' }}>
          <div style={{ background: '#eff6ff', borderRadius: 10, padding: '10px 16px', flex: 1 }}>
            <div style={{ fontSize: 11, color: '#2563eb', fontWeight: 600 }}>총 매출</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#2563eb' }}>{formatKRW(sales)}원</div>
          </div>
          <div style={{ background: '#fffbeb', borderRadius: 10, padding: '10px 16px', flex: 1 }}>
            <div style={{ fontSize: 11, color: '#d97706', fontWeight: 600 }}>총 매입</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#d97706' }}>{formatKRW(purchase)}원</div>
          </div>
          <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '10px 16px', flex: 1 }}>
            <div style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>순이익</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#059669' }}>{formatKRW(sales - purchase)}원</div>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {sorted.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0', fontSize: 13 }}>거래 내역이 없습니다</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f8fafc' }}>
                <tr>
                  {['날짜', '유형', '적요', '금액', '결제상태'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: '#94a3b8', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((tx, i) => (
                  <tr key={tx.id} style={{ borderBottom: '1px solid #f8fafc', background: i % 2 ? '#fafafa' : '#fff' }}>
                    <td style={{ padding: '10px 16px', color: '#64748b', whiteSpace: 'nowrap' }}>{tx.transaction_date}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ background: TYPE_BG[tx.type], color: TYPE_COLOR[tx.type], borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                        {tx.type}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', color: '#374151', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tx.memo || tx.description || '—'}
                    </td>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: TYPE_COLOR[tx.type], textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {formatKRW(Number(tx.total_amount))}원
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{
                        borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600,
                        background: tx.payment_status === '결제완료' || tx.payment_status === '지급완료' ? '#f0fdf4' : tx.payment_status === '미수금' || tx.payment_status === '미지급' ? '#fef2f2' : '#f8fafc',
                        color: tx.payment_status === '결제완료' || tx.payment_status === '지급완료' ? '#059669' : tx.payment_status === '미수금' || tx.payment_status === '미지급' ? '#dc2626' : '#94a3b8',
                      }}>{tx.payment_status || '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#374151' }}>{value}</div>
    </div>
  )
}

const btnPrimary = { padding: '9px 20px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }
const btnSmall = { padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#475569' }
