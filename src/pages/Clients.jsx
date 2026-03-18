import { useState, useEffect } from 'react'
import { getClients, createClient, updateClient, deleteClient, getTransactions } from '../lib/api'
import { formatKRW } from '../lib/utils'
import Modal, { FormRow, Input, Textarea, FormActions } from '../components/Modal'

const EMPTY = { name: '', contact_person: '', phone: '', email: '', address: '', notes: '' }

export default function Clients() {
  const [clients, setClients] = useState([])
  const [transactions, setTransactions] = useState([])
  const [modal, setModal] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

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
      .filter(t => t.client_id === clientId && t.type === '매출')
      .reduce((s, t) => s + Number(t.total_amount), 0)
  }

  const getTxCountForClient = (clientId) => {
    return transactions.filter(t => t.client_id === clientId).length
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

      <input
        placeholder="거래처명, 담당자, 연락처 검색..."
        value={search} onChange={e => setSearch(e.target.value)}
        style={{ width: '100%', maxWidth: 400, padding: '9px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 14, marginBottom: 16, background: '#fff' }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {loading ? (
          <div style={{ color: '#94a3b8', gridColumn: '1/-1', textAlign: 'center', padding: 40 }}>불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div style={{ color: '#94a3b8', gridColumn: '1/-1', textAlign: 'center', padding: 40, fontSize: 13 }}>거래처가 없습니다</div>
        ) : filtered.map(c => (
          <div key={c.id} style={{ background: '#fff', borderRadius: 14, padding: '20px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{c.name}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setModal(c)} style={btnSmall}>수정</button>
                <button onClick={() => handleDelete(c.id)} style={{ ...btnSmall, color: '#ef4444' }}>삭제</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              {c.contact_person && <Info label="담당자" value={c.contact_person} />}
              {c.phone && <Info label="연락처" value={c.phone} />}
              {c.email && <Info label="이메일" value={c.email} />}
              {c.address && <Info label="주소" value={c.address} />}
            </div>
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>총 매출</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#2563eb' }}>{formatKRW(getSalesForClient(c.id))}원</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>거래 건수</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#475569' }}>{getTxCountForClient(c.id)}건</div>
              </div>
            </div>
            {c.notes && (
              <div style={{ marginTop: 10, fontSize: 12, color: '#94a3b8', background: '#f8fafc', borderRadius: 8, padding: '8px 10px' }}>
                {c.notes}
              </div>
            )}
          </div>
        ))}
      </div>

      {modal && (
        <ClientModal
          client={modal === 'create' ? EMPTY : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
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
