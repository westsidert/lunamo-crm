import { useState } from 'react'
import { resetClient, isConfigured } from '../lib/supabase'

export default function Setup({ onDone }) {
  const [url, setUrl] = useState(localStorage.getItem('sb_url') || '')
  const [key, setKey] = useState(localStorage.getItem('sb_key') || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!url.startsWith('https://')) { setError('URL은 https://로 시작해야 합니다'); return }
    if (key.length < 20) { setError('Anon Key가 너무 짧습니다'); return }

    setLoading(true)
    localStorage.setItem('sb_url', url.trim())
    localStorage.setItem('sb_key', key.trim())
    resetClient()

    // 연결 테스트
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const client = createClient(url.trim(), key.trim())
      const { error: err } = await client.from('clients').select('id').limit(1)
      if (err && err.code !== 'PGRST116') throw err
      onDone()
    } catch (e) {
      setError('연결 실패: ' + (e.message || '설정을 확인해주세요'))
      localStorage.removeItem('sb_url')
      localStorage.removeItem('sb_key')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f1f5f9', padding: 20,
    }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 40, width: '100%', maxWidth: 480, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🎬</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>LUNAMO CRM</h1>
          <p style={{ fontSize: 14, color: '#64748b' }}>Supabase 연결 설정</p>
        </div>

        <div style={{ background: '#f8fafc', borderRadius: 12, padding: '16px 20px', marginBottom: 24, fontSize: 13, color: '#475569', lineHeight: 1.7 }}>
          <b>설정 방법:</b><br />
          1. <a href="https://supabase.com" target="_blank" style={{ color: '#2563eb' }}>supabase.com</a>에서 프로젝트 생성<br />
          2. <code style={{ background: '#e2e8f0', padding: '1px 5px', borderRadius: 4 }}>supabase-schema.sql</code> 파일을 SQL Editor에서 실행<br />
          3. Project Settings → API에서 URL과 anon key 복사
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 6 }}>
              Project URL <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://xxxx.supabase.co"
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 14 }}
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 6 }}>
              Anon Key <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              value={key} onChange={e => setKey(e.target.value)}
              placeholder="eyJhbGci..."
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 14, fontFamily: 'monospace' }}
            />
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#dc2626' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '12px', borderRadius: 10, border: 'none',
            background: loading ? '#93c5fd' : '#2563eb', color: '#fff',
            fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
          }}>
            {loading ? '연결 중...' : '연결하기'}
          </button>
        </form>
      </div>
    </div>
  )
}
