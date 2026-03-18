import { useState } from 'react'
import { getCrew, saveCrew } from '../lib/crew'

const EMPTY = { name: '', role: '', phone: '', rrn: '', memo: '' }

// 주민등록번호 자동 하이픈 포맷 (입력 중)
const formatRrn = (raw) => {
  const digits = raw.replace(/\D/g, '').slice(0, 13)
  if (digits.length <= 6) return digits
  return digits.slice(0, 6) + '-' + digits.slice(6)
}

// 목록 마스킹: 앞 6자리만 표시
const maskRrn = (rrn) => {
  if (!rrn) return null
  const digits = rrn.replace(/\D/g, '')
  if (digits.length < 7) return rrn
  return digits.slice(0, 6) + '-●●●●●●●'
}

export default function Crew() {
  const [crew, setCrew] = useState(getCrew)
  const [editing, setEditing] = useState(null)
  const [revealId, setRevealId] = useState(null) // 주민번호 공개 중인 행 id

  const handleSave = (member) => {
    const updated = member.id
      ? crew.map(c => c.id === member.id ? member : c)
      : [...crew, { ...member, id: Date.now().toString() }]
    saveCrew(updated)
    setCrew(updated)
    setEditing(null)
  }

  const handleDelete = (id) => {
    if (!confirm('삭제하시겠습니까?')) return
    const updated = crew.filter(c => c.id !== id)
    saveCrew(updated)
    setCrew(updated)
  }

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>인력 관리</h1>
          <p style={{ color: '#64748b', marginTop: 4, fontSize: 13 }}>
            외주 인력 목록 — 외주인건비 입력·원천징수 신고 시 활용
          </p>
        </div>
        <button onClick={() => setEditing({ ...EMPTY })} style={btnPrimary}>+ 인력 추가</button>
      </div>

      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              {['이름', '역할/분야', '연락처', '주민등록번호', '메모', ''].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 12, color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {crew.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 48, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>👤</div>
                  등록된 인력이 없습니다.<br />
                  <span style={{ fontSize: 12 }}>인력을 추가하면 외주인건비 입력 시 이름을 선택할 수 있습니다.</span>
                </td>
              </tr>
            ) : crew.map((member, idx) => {
              const isRevealed = revealId === member.id
              const masked = maskRrn(member.rrn)
              return (
                <tr key={member.id}
                  style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 1 ? '#fafafa' : '#fff' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
                  onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 1 ? '#fafafa' : '#fff'}
                >
                  <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                    {member.name}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {member.role
                      ? <span style={{ background: '#f1f5f9', color: '#475569', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500 }}>{member.role}</span>
                      : <span style={{ color: '#cbd5e1', fontSize: 12 }}>-</span>
                    }
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#64748b' }}>
                    {member.phone || <span style={{ color: '#cbd5e1' }}>-</span>}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {masked ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#374151', letterSpacing: '0.5px' }}>
                          {isRevealed ? member.rrn : masked}
                        </span>
                        <button
                          onClick={() => setRevealId(isRevealed ? null : member.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: '2px 4px', color: '#94a3b8', lineHeight: 1 }}
                          title={isRevealed ? '숨기기' : '보기'}
                        >
                          {isRevealed ? '🙈' : '👁'}
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: '#cbd5e1', fontSize: 12 }}>-</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#94a3b8', maxWidth: 200 }}>{member.memo || ''}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setEditing(member)} style={btnSmall}>수정</button>
                      <button onClick={() => handleDelete(member.id)} style={{ ...btnSmall, color: '#ef4444', borderColor: '#fecaca' }}>삭제</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <CrewModal member={editing} onClose={() => setEditing(null)} onSave={handleSave} />
      )}
    </div>
  )
}

function CrewModal({ member, onClose, onSave }) {
  const [form, setForm] = useState({ ...member })
  const [showRrn, setShowRrn] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleRrnChange = (e) => {
    set('rrn', formatRrn(e.target.value))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) { alert('이름을 입력해주세요'); return }
    onSave(form)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', marginBottom: 22 }}>
          {member.id ? '인력 수정' : '인력 추가'}
        </h3>
        <form onSubmit={handleSubmit}>
          {[
            ['이름 *', 'name', 'text', '예) 홍길동'],
            ['역할/분야', 'role', 'text', '예) 편집, 촬영, 작가'],
            ['연락처', 'phone', 'tel', '010-0000-0000'],
            ['메모', 'memo', 'text', '계좌번호 등'],
          ].map(([label, key, type, placeholder]) => (
            <div key={key} style={{ marginBottom: 14 }}>
              <label style={labelStyle}>{label}</label>
              <input
                type={type}
                value={form[key] || ''}
                onChange={e => set(key, e.target.value)}
                placeholder={placeholder}
                style={inputStyle}
              />
            </div>
          ))}

          {/* 주민등록번호 — 별도 처리 */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>주민등록번호</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showRrn ? 'text' : 'password'}
                value={form.rrn || ''}
                onChange={handleRrnChange}
                placeholder="000000-0000000"
                maxLength={14}
                style={{ ...inputStyle, fontFamily: 'monospace', letterSpacing: '1px', paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowRrn(v => !v)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#94a3b8', padding: 2 }}
                title={showRrn ? '숨기기' : '보기'}
              >
                {showRrn ? '🙈' : '👁'}
              </button>
            </div>
            <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 5 }}>
              🔒 이 기기의 브라우저에만 저장됩니다
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button type="button" onClick={onClose} style={btnCancel}>취소</button>
            <button type="submit" style={btnPrimary}>저장</button>
          </div>
        </form>
      </div>
    </div>
  )
}

const btnPrimary = { padding: '9px 20px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }
const btnCancel  = { padding: '9px 20px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 14, color: '#64748b' }
const btnSmall   = { padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#475569' }
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 6 }
const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, color: '#1e293b', outline: 'none', background: '#fff', boxSizing: 'border-box' }
