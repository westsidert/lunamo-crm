import { useState, useEffect } from 'react'
import { getProjects, createProject, updateProject, deleteProject, getClients, getTransactions } from '../lib/api'
import { formatKRW, formatDate } from '../lib/utils'
import Modal, { FormRow, Input, Select, Textarea, FormActions } from '../components/Modal'

const EMPTY = { name: '', client_id: '', status: '진행중', start_date: '', end_date: '', description: '', total_budget: '' }

export default function Projects() {
  const [projects, setProjects] = useState([])
  const [clients, setClients] = useState([])
  const [transactions, setTransactions] = useState([])
  const [modal, setModal] = useState(null)
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
    const labor = txs.filter(t => t.type === '외주인건비').reduce((s, t) => s + Number(t.supply_amount), 0)
    const profit = sales - purchase - labor
    const margin = sales > 0 ? Math.round(profit / sales * 100) : null
    return { sales, purchase, labor, profit, margin }
  }

  // 칸반 컬럼 정의 (사용자 요청 순서)
  const KANBAN_COLS = ['진행중', '보류', '취소', '완료']
  const colData = KANBAN_COLS.map(status => {
    const items = projects.filter(p => p.status === status)
    const totalBudget = items.reduce((s, p) => s + (Number(p.total_budget) || 0), 0)
    return { status, items, totalBudget }
  })

  const daysSince = (dateStr) => {
    if (!dateStr) return null
    const d = new Date(dateStr)
    const now = new Date()
    const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24))
    return diff
  }

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

      {/* 칸반 보드 */}
      {loading ? (
        <div style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>불러오는 중...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14, alignItems: 'start' }}>
          {colData.map(({ status, items, totalBudget }) => {
            const accent = statusStyle(status)
            return (
              <div key={status} style={{
                background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0',
                display: 'flex', flexDirection: 'column', minHeight: 200,
              }}>
                {/* 컬럼 헤더 */}
                <div style={{ padding: '12px 14px', borderBottom: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: accent.color }}>{status}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 10,
                        background: accent.background, color: accent.color,
                      }}>{items.length}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    예산 합계 · ₩{formatKRW(totalBudget)}
                  </div>
                </div>

                {/* 카드 리스트 */}
                <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                  {items.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: '#cbd5e1', fontSize: 13 }}>없음</div>
                  ) : items.map(p => {
                    const stats = getProjectStats(p.id)
                    const aging = p.start_date ? daysSince(p.start_date) : null
                    return (
                      <div key={p.id} style={{
                        background: '#fff', borderRadius: 10, padding: '12px 14px',
                        border: '1px solid #e2e8f0',
                        borderLeft: `4px solid ${accent.color || '#cbd5e1'}`,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', lineHeight: 1.35 }}>{p.name}</div>
                          {aging !== null && aging >= 0 && (
                            <span style={{
                              flexShrink: 0, padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 600,
                              background: aging > 90 ? '#fef2f2' : aging > 30 ? '#fffbeb' : '#f1f5f9',
                              color: aging > 90 ? '#dc2626' : aging > 30 ? '#d97706' : '#64748b',
                            }}>D+{aging}</span>
                          )}
                        </div>
                        {p.clients?.name && (
                          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>🏢 {p.clients.name}</div>
                        )}
                        <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#94a3b8', marginBottom: 8, flexWrap: 'wrap' }}>
                          {p.start_date && <span>📅 {formatDate(p.start_date)}</span>}
                          {p.end_date && <span>→ {formatDate(p.end_date)}</span>}
                        </div>
                        {p.total_budget > 0 && (
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
                            ₩ {formatKRW(p.total_budget)}
                          </div>
                        )}

                        {/* 매출/이익 한 줄 요약 */}
                        {(stats.sales > 0 || stats.profit !== 0) && (
                          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <span>매출 <b style={{ color: '#2563eb' }}>{formatKRW(stats.sales)}</b></span>
                            <span>이익 <b style={{ color: stats.profit >= 0 ? '#059669' : '#dc2626' }}>{formatKRW(stats.profit)}</b>
                              {stats.margin !== null && <span style={{ color: '#94a3b8' }}> ({stats.margin}%)</span>}
                            </span>
                          </div>
                        )}

                        {/* 예산 대비 매출 바 */}
                        {p.total_budget > 0 && (
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ height: 4, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{
                                height: '100%', borderRadius: 2, background: '#3b82f6',
                                width: `${Math.min(100, stats.sales / p.total_budget * 100)}%`,
                              }} />
                            </div>
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button onClick={() => setModal(p)} style={btnSmall}>수정</button>
                          <button onClick={() => {
                            const { id, clients, ...rest } = p
                            setModal(rest)
                          }} style={{ ...btnSmall, color: '#0891b2', borderColor: '#a5f3fc' }}>복제</button>
                          <button onClick={() => handleDelete(p.id)} style={{ ...btnSmall, color: '#ef4444' }}>삭제</button>
                        </div>
                      </div>
                    )
                  })}

                  {/* 빠른 추가 */}
                  <button
                    onClick={() => setModal({ ...EMPTY, status })}
                    style={{
                      marginTop: items.length === 0 ? 0 : 4,
                      padding: '8px', borderRadius: 8, border: '1px dashed #cbd5e1',
                      background: 'transparent', color: '#94a3b8', cursor: 'pointer',
                      fontSize: 12, fontWeight: 500,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = accent.color || '#94a3b8'; e.currentTarget.style.color = accent.color || '#475569' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#94a3b8' }}>
                    + 추가
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

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
