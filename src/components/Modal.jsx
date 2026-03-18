import { useEffect } from 'react'

export default function Modal({ title, onClose, children, width = 560 }) {
  useEffect(() => {
    const handler = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20,
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: width,
        maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}>
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #e2e8f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: '#0f172a' }}>{title}</h2>
          <button onClick={onClose} style={{
            background: '#f1f5f9', border: 'none', borderRadius: 8, width: 32, height: 32,
            cursor: 'pointer', fontSize: 18, color: '#64748b', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

export function FormRow({ label, required, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 6 }}>
        {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
      </label>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid #e2e8f0', fontSize: 14, color: '#1e293b',
  outline: 'none', background: '#fff',
}

export function Input({ ...props }) {
  return <input style={inputStyle} {...props} />
}

export function Select({ children, ...props }) {
  return (
    <select style={{ ...inputStyle, cursor: 'pointer' }} {...props}>
      {children}
    </select>
  )
}

export function Textarea({ ...props }) {
  return <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }} {...props} />
}

export function FormActions({ onClose, loading, label = '저장' }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
      <button type="button" onClick={onClose} style={{
        padding: '9px 20px', borderRadius: 8, border: '1px solid #e2e8f0',
        background: '#fff', cursor: 'pointer', fontSize: 14, color: '#64748b',
      }}>취소</button>
      <button type="submit" disabled={loading} style={{
        padding: '9px 24px', borderRadius: 8, border: 'none',
        background: loading ? '#93c5fd' : '#2563eb', color: '#fff',
        cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600,
      }}>
        {loading ? '저장 중...' : label}
      </button>
    </div>
  )
}
