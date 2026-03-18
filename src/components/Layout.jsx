import { useState } from 'react'
import { supabase } from '../lib/supabase'

const NAV_ITEMS = [
  { id: 'dashboard',    label: '대시보드', icon: '📊' },
  { id: 'transactions', label: '거래 내역', icon: '💰' },
  { id: 'quotes',       label: '견적서',   icon: '📋' },
  { id: 'projects',     label: '프로젝트', icon: '🎬' },
  { id: 'clients',      label: '거래처',   icon: '🏢' },
  { id: 'crew',         label: '인력',     icon: '👥' },
  { id: 'fixed',        label: '고정비',   icon: '🔄' },
]

export default function Layout({ children, page, setPage, session }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f1f5f9' }}>
      {/* Sidebar */}
      <aside style={{
        width: collapsed ? 64 : 220,
        background: '#0f172a',
        color: '#e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s',
        flexShrink: 0,
        position: 'fixed',
        top: 0, left: 0, bottom: 0,
        zIndex: 100,
      }}>
        {/* Logo */}
        <div style={{
          padding: collapsed ? '20px 0' : '20px 20px',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          minHeight: 64,
        }}>
          {!collapsed && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.3px' }}>
                LUNAMO
              </div>
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>영상 프로덕션 CRM</div>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)} style={{
            background: 'none', border: 'none', color: '#64748b', cursor: 'pointer',
            fontSize: 16, padding: 4, borderRadius: 4,
          }}>
            {collapsed ? '→' : '←'}
          </button>
        </div>

        {/* Nav */}
        <nav style={{ padding: '12px 8px', flex: 1 }}>
          {NAV_ITEMS.map(item => (
            <button key={item.id} onClick={() => setPage(item.id)} style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: collapsed ? '10px 0' : '10px 12px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              marginBottom: 4,
              background: page === item.id ? '#1e3a5f' : 'none',
              color: page === item.id ? '#60a5fa' : '#94a3b8',
              fontSize: 14,
              fontWeight: page === item.id ? 600 : 400,
              transition: 'all 0.15s',
            }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div style={{
          padding: collapsed ? '16px 8px' : '16px 12px',
          borderTop: '1px solid #1e293b',
        }}>
          {!collapsed && session && (
            <div style={{ fontSize: 11, color: '#475569', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {session.user.email}
            </div>
          )}
          <button
            onClick={() => supabase.auth.signOut()}
            title="로그아웃"
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', gap: 8,
              padding: collapsed ? '8px 0' : '8px 10px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              borderRadius: 8, border: 'none',
              background: 'none', color: '#64748b',
              fontSize: 13, cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 14 }}>🚪</span>
            {!collapsed && <span>로그아웃</span>}
          </button>
          {!collapsed && (
            <div style={{ fontSize: 10, color: '#1e293b', marginTop: 6, paddingLeft: 10 }}>v1.0.0</div>
          )}
        </div>
      </aside>

      {/* Main */}
      <main style={{
        flex: 1,
        marginLeft: collapsed ? 64 : 220,
        transition: 'margin-left 0.2s',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {children}
      </main>
    </div>
  )
}
