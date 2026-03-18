import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) setError(err.message === 'Invalid login credentials' ? '이메일 또는 비밀번호가 올바르지 않습니다.' : err.message)
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0f172a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ width: '100%', maxWidth: 400, padding: '0 24px' }}>

        {/* 로고 */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#f8fafc', letterSpacing: 4 }}>LUNAMO</div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 6, letterSpacing: 2 }}>영상 프로덕션 CRM</div>
        </div>

        {/* 카드 */}
        <form onSubmit={handleLogin} style={{
          background: '#1e293b', borderRadius: 16, padding: '32px 28px',
          border: '1px solid #334155',
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', marginBottom: 24 }}>로그인</div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6, fontWeight: 500 }}>이메일</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="이메일 주소" required autoComplete="email"
              style={{
                width: '100%', padding: '11px 14px', borderRadius: 10,
                border: '1px solid #334155', background: '#0f172a', color: '#f1f5f9',
                fontSize: 14, boxSizing: 'border-box', outline: 'none',
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6, fontWeight: 500 }}>비밀번호</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="비밀번호" required autoComplete="current-password"
              style={{
                width: '100%', padding: '11px 14px', borderRadius: 10,
                border: '1px solid #334155', background: '#0f172a', color: '#f1f5f9',
                fontSize: 14, boxSizing: 'border-box', outline: 'none',
              }}
            />
          </div>

          {error && (
            <div style={{
              background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 8,
              padding: '10px 14px', fontSize: 13, color: '#fca5a5', marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '12px', borderRadius: 10, border: 'none',
            background: loading ? '#334155' : '#3b82f6', color: '#fff',
            fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
          }}>
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#334155' }}>
          계정 관련 문의는 관리자에게 연락하세요
        </div>
      </div>
    </div>
  )
}
