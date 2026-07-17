import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import useIsMobile from '../lib/useIsMobile'

const NAV_ITEMS = [
  { id: 'dashboard',    label: '대시보드', icon: '📊' },
  { id: 'transactions', label: '거래 내역', icon: '💰' },
  { id: 'quotes',       label: '견적서',   icon: '📋' },
  { id: 'projects',     label: '프로젝트', icon: '🎬' },
  { id: 'clients',      label: '거래처',   icon: '🏢' },
  { id: 'crew',         label: '인력',     icon: '👥' },
  { id: 'withholding',  label: '원천세 신고', icon: '🧾' },
  { id: 'fixed',        label: '고정비',   icon: '🔄' },
]

export default function Layout({ children, page, setPage, session }) {
  const isMobile = useIsMobile()
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // 페이지 이동 시 모바일 드로어 자동 닫기
  useEffect(() => { setDrawerOpen(false) }, [page])

  const currentLabel = NAV_ITEMS.find(i => i.id === page)?.label || ''

  const navButtons = (compact) => NAV_ITEMS.map(item => (
    <button key={item.id} onClick={() => setPage(item.id)} style={{
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: compact ? '10px 0' : '10px 12px',
      justifyContent: compact ? 'center' : 'flex-start',
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
      {!compact && <span>{item.label}</span>}
    </button>
  ))

  const footer = (compact) => (
    <div style={{
      padding: compact ? '16px 8px' : '16px 12px',
      borderTop: '1px solid #1e293b',
    }}>
      {!compact && session && (
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
          padding: compact ? '8px 0' : '8px 10px',
          justifyContent: compact ? 'center' : 'flex-start',
          borderRadius: 8, border: 'none',
          background: 'none', color: '#64748b',
          fontSize: 13, cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 14 }}>🚪</span>
        {!compact && <span>로그아웃</span>}
      </button>
      {!compact && (
        <div style={{ fontSize: 10, color: '#1e293b', marginTop: 6, paddingLeft: 10 }}>v1.0.0</div>
      )}
    </div>
  )

  // ── 모바일: 상단 바 + 드로어 ─────────────────────────
  if (isMobile) {
    return (
      <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
        <header style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
          height: 52, background: '#0f172a', color: '#e2e8f0',
          display: 'flex', alignItems: 'center', gap: 12, padding: '0 14px',
          paddingTop: 'env(safe-area-inset-top)',
        }}>
          <button onClick={() => setDrawerOpen(true)} aria-label="메뉴 열기" style={{
            background: 'none', border: 'none', color: '#e2e8f0', fontSize: 20,
            cursor: 'pointer', padding: '6px 4px', lineHeight: 1,
          }}>☰</button>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.3px' }}>LUNAMO</div>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>{currentLabel}</div>
        </header>

        {drawerOpen && (
          <div onClick={() => setDrawerOpen(false)} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200,
          }}>
            <aside onClick={e => e.stopPropagation()} style={{
              position: 'absolute', top: 0, left: 0, bottom: 0, width: 240,
              background: '#0f172a', color: '#e2e8f0',
              display: 'flex', flexDirection: 'column',
              paddingTop: 'env(safe-area-inset-top)',
            }}>
              <div style={{
                padding: '18px 20px', borderBottom: '1px solid #1e293b',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.3px' }}>LUNAMO</div>
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>영상 프로덕션 CRM</div>
                </div>
                <button onClick={() => setDrawerOpen(false)} aria-label="메뉴 닫기" style={{
                  background: 'none', border: 'none', color: '#64748b', fontSize: 18, cursor: 'pointer', padding: 4,
                }}>×</button>
              </div>
              <nav style={{ padding: '12px 8px', flex: 1, overflowY: 'auto' }}>
                {navButtons(false)}
              </nav>
              {footer(false)}
            </aside>
          </div>
        )}

        <main style={{
          paddingTop: 'calc(52px + env(safe-area-inset-top))',
          minHeight: '100vh',
          display: 'flex', flexDirection: 'column',
        }}>
          {children}
        </main>
      </div>
    )
  }

  // ── 데스크톱: 기존 사이드바 ──────────────────────────
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f1f5f9' }}>
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

        <nav style={{ padding: '12px 8px', flex: 1 }}>
          {navButtons(collapsed)}
        </nav>

        {footer(collapsed)}
      </aside>

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
