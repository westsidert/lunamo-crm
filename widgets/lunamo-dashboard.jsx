// LUNAMO CRM 바탕화면 위젯 (Übersicht)
// 설치: 이 파일을 ~/Library/Application Support/Übersicht/widgets/ 에 복사
// 토큰: 아래 TOKEN 값을 본인 WIDGET_TOKEN으로 교체

const BASE = 'https://lunamo-crm.vercel.app'
const TOKEN = '__WIDGET_TOKEN__'

export const refreshFrequency = 300000 // 5분

// WebView의 fetch는 CORS에 막히므로 shell curl로 호출 (Übersicht 표준 방식)
export const command = `curl -s --max-time 15 "${BASE}/api/widget-stats?token=${TOKEN}"`

export const initialState = { loading: true }

export const updateState = (event, prev) => {
  if (event.error) return { loading: false, error: String(event.error) }
  if (typeof event.output === 'string') {
    if (!event.output.trim()) return { loading: false, error: '응답 없음 (네트워크 확인)' }
    try {
      const data = JSON.parse(event.output)
      if (data.error) return { loading: false, error: data.error }
      return { loading: false, data }
    } catch {
      return { loading: false, error: '응답 파싱 실패' }
    }
  }
  return prev
}

export const className = `
  top: 40px;
  right: 40px;
  width: 300px;
  font-family: -apple-system, 'Apple SD Gothic Neo', sans-serif;
  color: #e2e8f0;
  -webkit-font-smoothing: antialiased;
  z-index: 0;
`

const card = {
  background: 'rgba(15,23,42,0.82)',
  backdropFilter: 'blur(20px)',
  borderRadius: 16,
  border: '1px solid rgba(148,163,184,0.18)',
  padding: '16px 18px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
}

const won = (n) => {
  const v = Number(n) || 0
  if (Math.abs(v) >= 100000000) return (v / 100000000).toFixed(1).replace(/\.0$/, '') + '억'
  if (Math.abs(v) >= 10000) return Math.round(v / 10000).toLocaleString('ko-KR') + '만'
  return v.toLocaleString('ko-KR')
}

const DOT = { danger: '#ef4444', warn: '#f59e0b', ok: '#22c55e', info: '#3b82f6' }

const Row = ({ state, label, value }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
    <span style={{ width: 7, height: 7, borderRadius: '50%', background: DOT[state], flexShrink: 0 }} />
    <span style={{ fontSize: 11, color: '#94a3b8', flex: 1 }}>{label}</span>
    <span style={{ fontSize: 12, fontWeight: 600, color: state === 'ok' ? '#64748b' : '#f1f5f9' }}>{value}</span>
  </div>
)

export const render = ({ loading, error, data }) => {
  if (error || (!loading && !data)) {
    return (
      <div style={card}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#f87171', marginBottom: 4 }}>LUNAMO 연결 실패</div>
        <div style={{ fontSize: 10, color: '#64748b' }}>{error || '데이터 없음'}</div>
      </div>
    )
  }
  if (loading || !data) return <div style={card}><div style={{ fontSize: 12, color: '#64748b' }}>LUNAMO 불러오는 중...</div></div>

  const { month, alerts, updated_at } = data
  const a = alerts
  const rows = [
    {
      key: 'receivable', label: '미수금',
      state: a.receivable.count90 > 0 ? 'danger' : a.receivable.count30 > 0 ? 'warn' : 'ok',
      value: a.receivable.total > 0 ? `${a.receivable.total}건 ${won(a.receivable.totalAmount)}` : '정상',
    },
    {
      key: 'tax', label: '원천세 신고',
      state: a.tax ? (a.tax.daysLeft < 0 ? 'danger' : 'warn') : 'ok',
      value: a.tax
        ? `${a.tax.doneCount}/4 · ${a.tax.daysLeft < 0 ? '마감초과' : 'D-' + a.tax.daysLeft}`
        : '완료',
    },
    {
      key: 'labor', label: '미지급 인건비',
      state: a.unpaidLabor.count > 0 ? 'warn' : 'ok',
      value: a.unpaidLabor.count > 0 ? `${a.unpaidLabor.count}건 ${won(a.unpaidLabor.amount)}` : '정상',
    },
    {
      key: 'invoice', label: '세금계산서 미발행',
      state: a.unissuedInvoices > 0 ? 'warn' : 'ok',
      value: a.unissuedInvoices > 0 ? `${a.unissuedInvoices}건` : '정상',
    },
    {
      key: 'project', label: '프로젝트 마감',
      state: a.projects.overdue > 0 ? 'danger' : a.projects.soon > 0 ? 'warn' : 'ok',
      value: a.projects.overdue > 0 ? `지연 ${a.projects.overdue}건`
        : a.projects.soon > 0 ? `7일내 ${a.projects.soon}건` : '정상',
    },
    {
      key: 'quote', label: '발송 견적 대기',
      state: a.sentQuotes.count > 0 ? 'info' : 'ok',
      value: a.sentQuotes.count > 0 ? `${a.sentQuotes.count}건 ${won(a.sentQuotes.amount)}` : '없음',
    },
  ]
  const alertCount = rows.filter(r => r.state === 'danger' || r.state === 'warn').length
  const t = new Date(updated_at)
  const hh = String(t.getHours()).padStart(2, '0')
  const mm = String(t.getMinutes()).padStart(2, '0')

  return (
    <div style={card}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.2px' }}>LUNAMO</div>
        {alertCount > 0 ? (
          <div style={{ fontSize: 10, fontWeight: 700, color: '#fca5a5', background: 'rgba(239,68,68,0.15)', padding: '2px 8px', borderRadius: 20 }}>
            주의 {alertCount}건
          </div>
        ) : (
          <div style={{ fontSize: 10, fontWeight: 700, color: '#86efac', background: 'rgba(34,197,94,0.15)', padding: '2px 8px', borderRadius: 20 }}>
            모두 정상
          </div>
        )}
      </div>

      {/* 이번달 요약 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {[
          ['이번달 매출', won(month.sales), '#60a5fa'],
          ['순이익', (month.profit >= 0 ? '' : '-') + won(Math.abs(month.profit)), month.profit >= 0 ? '#4ade80' : '#f87171'],
        ].map(([label, value, color]) => (
          <div key={label} style={{ flex: 1, background: 'rgba(30,41,59,0.6)', borderRadius: 10, padding: '8px 10px' }}>
            <div style={{ fontSize: 9, color: '#64748b', marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* 경고등 */}
      <div style={{ borderTop: '1px solid rgba(148,163,184,0.12)', paddingTop: 6 }}>
        {rows.map(r => <Row key={r.key} state={r.state} label={r.label} value={r.value} />)}
      </div>

      <div style={{ fontSize: 9, color: '#475569', textAlign: 'right', marginTop: 8 }}>
        {month.month}월 · {hh}:{mm} 갱신
      </div>
    </div>
  )
}
