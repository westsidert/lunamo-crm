import { useState, useEffect } from 'react'
import { getProjects, createProject, updateProject, deleteProject, getClients, getTransactions } from '../lib/api'
import { formatKRW, formatDate, STATUS_COLORS } from '../lib/utils'
import Modal, { FormRow, Input, Select, Textarea, FormActions } from '../components/Modal'

const EMPTY = { name: '', client_id: '', status: '진행중', start_date: '', end_date: '', description: '', total_budget: '' }

export default function Projects() {
  const [projects, setProjects] = useState([])
  const [clients, setClients] = useState([])
  const [transactions, setTransactions] = useState([])
  const [modal, setModal] = useState(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [pr, cl, tx] = await Promise.all([getProjects(), getClients(), getTransactions()])
      setProjects(pr)
      setClients(cl)
      setTransactions(tx)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const getProjectStats = (projectId) => {
    const txs = transactions.filter(t => t.project_id === projectId)
    const sales = txs.filter(t => t.type === '매출').reduce((s, t) => s + Number(t.total_amount), 0)
    const purchase = txs.filter(t => t.type === '매입').reduce((s, t) => s + Number(t.total_amount), 0)
    return { sales, purchase, profit: sales - purchase }
  }

  const filtered = projects.filter(p => !filterStatus || p.status === filterStatus)

  const handleSave = async (data) => {
    if (modal === 'create' || !modal.id) {
      const created = await createProject(data)
      setProjects(prev => [created, ...prev])
    } else {
      const updated = await updateProject(modal.id, data)
      setProjects(prev => prev.map(p => p.id === updated.id ? updated : p))
    }
    setModal(null)
  }

  const handleDelete = async (id) => {
    if (!confirm('프로젝트를 삭제하시겠습니까?')) return
    await deleteProject(id)
    setProjects(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>프로젝트</h1>
          <p style={{ color: '#64748b', marginTop: 4, fontSize: 13 }}>{projects.length}개 프로젝트</p>
        </div>
        <button onClick={() => setModal('create')} style={btnPrimary}>+ 프로젝트 추가</button>
      </div>

      {/* Status filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['', '진행중', '완료', '보류', '취소'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} style={{
            padding: '6px 14px', borderRadius: 20, border: '1px solid',
            borderColor: filterStatus === s ? '#2563eb' : '#e2e8f0',
            background: filterStatus === s ? '#eff6ff' : '#fff',
            color: filterStatus === s ? '#2563eb' : '#64748b',
            cursor: 'pointer', fontSize: 13, fontWeight: filterStatus === s ? 600 : 400,
          }}>
            {s || '전체'}
            {s && ` (${projects.filter(p => p.status === s).length})`}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
        {loading ? (
          <div style={{ color: '#94a3b8', gridColumn: '1/-1', textAlign: 'center', padding: 40 }}>불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div style={{ color: '#94a3b8', gridColumn: '1/-1', textAlign: 'center', padding: 40, fontSize: 13 }}>프로젝트가 없습니다</div>
        ) : filtered.map(p => {
          const stats = getProjectStats(p.id)
          return (
            <div key={p.id} style={{ background: '#fff', borderRadius: 14, padding: '20px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{
                  padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  ...statusStyle(p.status),
                }}>{p.status}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setModal(p)} style={btnSmall}>수정</button>
                  <button onClick={() => {
                    const { id, clients, ...rest } = p
                    setModal(rest)
                  }} style={{ ...btnSmall, color: '#0891b2', borderColor: '#a5f3fc' }}>복제</button>
                  <button onClick={() => handleDelete(p.id)} style={{ ...btnSmall, color: '#ef4444' }}>삭제</button>
                </div>
              </div>

              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>{p.name}</div>
              {p.clients?.name && (
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 10 }}>🏢 {p.clients.name}</div>
              )}

              <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>
                {p.start_date && <span>📅 {formatDate(p.start_date)}</span>}
                {p.end_date && <span>→ {formatDate(p.end_date)}</span>}
              </div>

              {p.description && (
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14, lineHeight: 1.5 }}>{p.description}</div>
              )}

              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                <Stat label="매출" value={formatKRW(stats.sales)} color="#2563eb" />
                <Stat label="매입" value={formatKRW(stats.purchase)} color="#d97706" />
                <Stat label="순이익" value={formatKRW(stats.profit)} color={stats.profit >= 0 ? '#059669' : '#dc2626'} />
              </div>

              {p.total_budget > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
                    <span>예산 대비 매출</span>
                    <span>{Math.min(100, Math.round(stats.sales / p.total_budget * 100))}%</span>
                  </div>
                  <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3, background: '#3b82f6',
                      width: `${Math.min(100, stats.sales / p.total_budget * 100)}%`,
                      transition: 'width 0.3s',
                    }} />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {modal && (
        <ProjectModal
          project={modal === 'create' ? EMPTY : modal}
          clients={clients}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

function ProjectModal({ project, clients, onClose, onSave }) {
  const [form, setForm] = useState({ ...project })
  const [loading, setLoading] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onSave({
        name: form.name,
        client_id: form.client_id || null,
        status: form.status,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        description: form.description,
        total_budget: Number(form.total_budget) || 0,
      })
    } catch (e) { alert('저장 실패: ' + e.message) }
    setLoading(false)
  }

  return (
    <Modal title={project.id ? '프로젝트 수정' : '프로젝트 추가'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <FormRow label="프로젝트명" required>
          <Input placeholder="2025 기업홍보영상 제작" value={form.name} onChange={e => set('name', e.target.value)} required />
        </FormRow>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormRow label="거래처">
            <Select value={form.client_id} onChange={e => set('client_id', e.target.value)}>
              <option value="">선택 안 함</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </FormRow>
          <FormRow label="상태">
            <Select value={form.status} onChange={e => set('status', e.target.value)}>
              {['진행중', '완료', '보류', '취소'].map(s => <option key={s}>{s}</option>)}
            </Select>
          </FormRow>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormRow label="시작일">
            <Input type="date" value={form.start_date || ''} onChange={e => set('start_date', e.target.value)} />
          </FormRow>
          <FormRow label="종료일">
            <Input type="date" value={form.end_date || ''} onChange={e => set('end_date', e.target.value)} />
          </FormRow>
        </div>
        <FormRow label="예산">
          <Input type="number" placeholder="50000000" value={form.total_budget || ''} onChange={e => set('total_budget', e.target.value)} />
        </FormRow>
        <FormRow label="설명">
          <Textarea placeholder="프로젝트 개요, 내용 등" value={form.description || ''} onChange={e => set('description', e.target.value)} />
        </FormRow>
        <FormActions onClose={onClose} loading={loading} />
      </form>
    </Modal>
  )
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color }}>{value}원</div>
    </div>
  )
}

const statusStyle = (s) => {
  const map = {
    '진행중': { background: '#eff6ff', color: '#2563eb' },
    '완료': { background: '#f0fdf4', color: '#16a34a' },
    '보류': { background: '#fffbeb', color: '#d97706' },
    '취소': { background: '#fef2f2', color: '#dc2626' },
  }
  return map[s] || {}
}

const btnPrimary = { padding: '9px 20px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }
const btnSmall = { padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#475569' }
