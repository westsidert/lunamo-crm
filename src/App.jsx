import { useState, useEffect } from 'react'
import './index.css'
import { supabase, isConfigured } from './lib/supabase'
import { migrateToSupabase, syncFromSupabase } from './lib/settings'
import Setup from './pages/Setup'
import Login from './pages/Login'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Projects from './pages/Projects'
import Clients from './pages/Clients'
import Quotes from './pages/Quotes'
import Crew from './pages/Crew'
import FixedExpenses from './pages/FixedExpenses'

function App() {
  const [configured] = useState(isConfigured)
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [page, setPage] = useState('dashboard')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthLoading(false)
      if (session) migrateToSupabase().then(() => syncFromSupabase()).catch(console.error)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (!configured) {
    return <Setup onDone={() => window.location.reload()} />
  }

  if (authLoading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0f172a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ color: '#475569', fontSize: 14 }}>로딩 중...</div>
      </div>
    )
  }

  if (!session) {
    return <Login />
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard />
      case 'transactions': return <Transactions />
      case 'projects': return <Projects />
      case 'clients': return <Clients />
      case 'quotes': return <Quotes />
      case 'crew': return <Crew />
      case 'fixed': return <FixedExpenses />
      default: return <Dashboard />
    }
  }

  return (
    <Layout page={page} setPage={setPage} session={session}>
      {renderPage()}
    </Layout>
  )
}

export default App
