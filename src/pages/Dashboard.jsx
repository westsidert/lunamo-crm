import { useState, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import { getDashboardStats, getYearlyStats, getUnpaidSales, getRecentTransactions, getFixedExpenses } from '../lib/api'
import { formatKRW, thisYear, thisMonth, MONTHS } from '../lib/utils'

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#84cc16','#f97316']

const TYPE_COLOR  = { '매출': '#2563eb', '매입': '#d97706', '외주인건비': '#7c3aed' }
const TYPE_BG     = { '매출': '#eff6ff', '매입': '#fffbeb', '외주인건비': '#f5f3ff' }

export default function Dashboard() {
  const [year, setYear] = useState(thisYear())
  const [month, setMonth] = useState(thisMonth())
  const [exVat, setExVat] = useState(false)

  const [yearRaw, setYearRaw]           = useState([])
  const [prevYearRaw, setPrevYearRaw]   = useState([])
  const [monthStats, setMonthStats]     = useState([])
  const [prevMonthStats, setPrevMonthStats] = useState([])
  const [unpaidTx, setUnpaidTx]         = useState([])
  const [recentTx, setRecentTx]         = useState([])
  const [fixedExpenses, setFixedExpenses] = useState([])
  const [loading, setLoading]           = useState(true)

  // 직전 월 계산 (1월이면 전년 12월)
  const prevYear  = month === 1 ? year - 1 : year
  const prevMonth = month === 1 ? 12 : month - 1

  useEffect(() => {
    getFixedExpenses().then(setFixedExpenses).catch(console.error)
  }, [])

  useEffect(() => {
    getYearlyStats(year).then(setYearRaw).catch(console.error)
    getYearlyStats(year - 1).then(setPrevYearRaw).catch(console.error)
    getUnpaidSales().then(setUnpaidTx).catch(console.error)
    getRecentTransactions(7).then(setRecentTx).catch(console.error)
  }, [year])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getDashboardStats(year, month),
      getDashboardStats(prevYear, prevMonth),
    ]).then(([curr, prev]) => {
      setMonthStats(curr)
      setPrevMonthStats(prev)
      setLoading(false)
    }).catch(e => { console.error(e); setLoading(false) })
  }, [year, month])

  // 금액 헬퍼: 부가세 포함/제외 토글 반영 (외주인건비는 항상 공급가)
  const amt = (tx) => {
    if (tx.type === '외주인건비') return Number(tx.supply_amount)
    return exVat ? Number(tx.supply_amount) : Number(tx.total_amount)
  }

  // 결제 주기별 월 환산 금액
  const feMonthly = (fe) => Math.round(fe.amount / ({ '월간': 1, '분기': 3, '연간': 12 }[fe.billing_cycle] ?? 1))

  // 특정 연/월에 활성인 고정비 합산 (월 환산 기준)
  const getMonthFixed = (yr, mo) => {
    const first = `${yr}-${String(mo).padStart(2, '0')}-01`
    const last  = `${yr}-${String(mo).padStart(2, '0')}-${new Date(yr, mo, 0).getDate()}`
    return fixedExpenses
      .filter(fe => fe.is_active && fe.start_date <= last && (!fe.end_date || fe.end_date >= first))
      .reduce((s, fe) => s + feMonthly(fe), 0)
  }

  // 연간 고정비 (12개월 합산)
  const getYearFixed = (yr) => {
    let total = 0
    for (let m = 1; m <= 12; m++) total += getMonthFixed(yr, m)
    return total
  }

  // ── 연간 KPI ──────────────────────────────────────
  const aSales      = yearRaw.filter(t => t.type === '매출').reduce((s,t) => s + amt(t), 0)
  const aPurchase   = yearRaw.filter(t => t.type === '매입').reduce((s,t) => s + amt(t), 0)
  const aLabor      = yearRaw.filter(t => t.type === '외주인건비').reduce((s,t) => s + amt(t), 0)
  const aFixed      = getYearFixed(year)
  const aProfit     = aSales - aPurchase - aLabor - aFixed
  const aMargin     = aSales ? Math.round(aProfit / aSales * 100) : 0
  const aSalesCnt   = yearRaw.filter(t => t.type === '매출').length
  const aPurchaseCnt = yearRaw.filter(t => t.type === '매입').length
  const aLaborCnt   = yearRaw.filter(t => t.type === '외주인건비').length

  // ── 전년 연간 KPI (전년 대비 비교용) ──────────────
  const pyaSales    = prevYearRaw.filter(t => t.type === '매출').reduce((s,t) => s + amt(t), 0)
  const pyaPurchase = prevYearRaw.filter(t => t.type === '매입').reduce((s,t) => s + amt(t), 0)
  const pyaLabor    = prevYearRaw.filter(t => t.type === '외주인건비').reduce((s,t) => s + amt(t), 0)
  const pyaFixed    = getYearFixed(year - 1)
  const pyaProfit   = pyaSales - pyaPurchase - pyaLabor - pyaFixed

  // ── 월별 KPI ──────────────────────────────────────
  const mSales      = monthStats.filter(t => t.type === '매출').reduce((s,t) => s + amt(t), 0)
  const mPurchase   = monthStats.filter(t => t.type === '매입').reduce((s,t) => s + amt(t), 0)
  const mLabor      = monthStats.filter(t => t.type === '외주인건비').reduce((s,t) => s + amt(t), 0)
  const fixedTotal  = getMonthFixed(year, month)
  const fixedCount  = (() => {
    const first = `${year}-${String(month).padStart(2, '0')}-01`
    const last  = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`
    return fixedExpenses.filter(fe => fe.is_active && fe.start_date <= last && (!fe.end_date || fe.end_date >= first)).length
  })()
  const mProfit     = mSales - mPurchase - mLabor - fixedTotal
  const mSalesCnt   = monthStats.filter(t => t.type === '매출').length
  const mPurchaseCnt = monthStats.filter(t => t.type === '매입').length
  const mLaborCnt   = monthStats.filter(t => t.type === '외주인건비').length

  // ── 직전 월 KPI ───────────────────────────────────
  const pSales    = prevMonthStats.filter(t => t.type === '매출').reduce((s,t) => s + amt(t), 0)
  const pPurchase = prevMonthStats.filter(t => t.type === '매입').reduce((s,t) => s + amt(t), 0)
  const pLabor    = prevMonthStats.filter(t => t.type === '외주인건비').reduce((s,t) => s + amt(t), 0)
  const prevFixedTotal = getMonthFixed(prevYear, prevMonth)
  const pProfit   = pSales - pPurchase - pLabor - prevFixedTotal

  // ── 미결제 합산 ───────────────────────────────────
  const unpaidTotal = unpaidTx.reduce((s, t) => s + (exVat ? Number(t.supply_amount) : Number(t.total_amount)), 0)

  // ── 월별 추이 차트 ────────────────────────────────
  const trendData = (() => {
    const map = {}
    for (let i = 1; i <= 12; i++) map[i] = { month: `${i}월`, 매출: 0, 매입: 0, 외주인건비: 0 }
    yearRaw.forEach(tx => {
      const m = new Date(tx.transaction_date).getMonth() + 1
      map[m][tx.type] += amt(tx)
    })
    return Object.values(map)
  })()

  // ── 거래처별 매출 차트 ────────────────────────────
  const clientSalesData = (() => {
    const map = {}
    yearRaw.filter(t => t.type === '매출').forEach(tx => {
      const name = tx.clients?.name || '미지정'
      if (!map[name]) map[name] = 0
      map[name] += amt(tx)
    })
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  })()

  const vatLabel = exVat ? '부가세 제외' : '부가세 포함'

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, width: '100%' }}>

      {/* ── 헤더 ────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>대시보드</h1>
          <p style={{ color: '#64748b', marginTop: 4, fontSize: 13 }}>루나모 영상 프로덕션 현황</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setExVat(v => !v)} style={{
            padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s',
            background: exVat ? '#f0fdf4' : '#eff6ff',
            color: exVat ? '#059669' : '#2563eb',
            border: `1.5px solid ${exVat ? '#86efac' : '#bfdbfe'}`,
          }}>
            {exVat ? '✓ 부가세 제외' : '부가세 포함'}
          </button>
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={selStyle}>
            {[2023,2024,2025,2026].map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* ── 연간 현황 KPI ────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <SectionLabel title={`📊 ${year}년 연간 현황`} badge={vatLabel} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(140px, 1fr))', gap: 16 }}>
          <KpiCard label="연 매출" value={formatKRW(aSales)} sub={`${aSalesCnt}건`} color="#2563eb" large
            delta={aSales - pyaSales} prevLabel={`${year-1}년`} prevValue={pyaSales} />
          <KpiCard label="연 매입" value={formatKRW(aPurchase)} sub={`${aPurchaseCnt}건`} color="#d97706" large
            delta={aPurchase - pyaPurchase} prevLabel={`${year-1}년`} prevValue={pyaPurchase} />
          <KpiCard label="연 외주인건비" value={formatKRW(aLabor)} sub={`${aLaborCnt}건`} color="#7c3aed" large
            delta={aLabor - pyaLabor} prevLabel={`${year-1}년`} prevValue={pyaLabor} />
          <KpiCard
            label="연 순이익" value={formatKRW(aProfit)}
            sub={aProfit >= 0 ? '흑자' : '적자'}
            color={aProfit >= 0 ? '#059669' : '#dc2626'} large
            delta={aProfit - pyaProfit} prevLabel={`${year-1}년`} prevValue={pyaProfit}
          />
          <KpiCard
            label="연 이익률" value={aSales ? `${aMargin}%` : '-'}
            sub={`${year}년 전체`} color="#7c3aed" large
          />
        </div>
      </div>

      {/* ── 미수금 현황 배너 ─────────────────────────── */}
      {unpaidTx.length > 0 && (
        <div style={{
          marginBottom: 28, borderRadius: 14, overflow: 'hidden',
          border: '1px solid #fecaca', background: '#fff',
        }}>
          {/* 헤더 */}
          <div style={{
            background: 'linear-gradient(135deg, #fef2f2, #fff7ed)',
            borderBottom: '1px solid #fecaca',
            padding: '14px 20px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>🔴</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#dc2626' }}>미수금 현황</span>
              <span style={{
                background: '#dc2626', color: '#fff', borderRadius: 20,
                fontSize: 11, fontWeight: 700, padding: '2px 8px',
              }}>{unpaidTx.length}건</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#dc2626' }}>
              총 {formatKRW(unpaidTotal)}원
            </div>
          </div>
          {/* 목록 */}
          <div style={{ padding: '4px 0' }}>
            {unpaidTx.map((tx, i) => {
              const days = Math.floor((new Date() - new Date(tx.transaction_date)) / 86400000)
              const urgent = days >= 30
              return (
                <div key={tx.id} style={{
                  display: 'grid', gridTemplateColumns: '110px 1fr 1fr auto auto',
                  gap: 12, alignItems: 'center',
                  padding: '10px 20px',
                  background: i % 2 === 0 ? '#fff' : '#fafafa',
                  fontSize: 13,
                }}>
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>{tx.transaction_date}</span>
                  <span style={{ color: '#374151', fontWeight: 500 }}>{tx.clients?.name || '미지정'}</span>
                  <span style={{ color: '#64748b' }}>{tx.memo || '—'}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                    background: urgent ? '#fef2f2' : '#fff7ed',
                    color: urgent ? '#dc2626' : '#d97706',
                    whiteSpace: 'nowrap',
                  }}>
                    D+{days}
                  </span>
                  <span style={{ color: '#dc2626', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {formatKRW(exVat ? Number(tx.supply_amount) : Number(tx.total_amount))}원
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── 월별 현황 KPI ────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>📅 월별 현황</span>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ ...selStyle, fontSize: 13 }}>
            {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <span style={badgeStyle}>{vatLabel}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(120px, 1fr))', gap: 16 }}>
          <KpiCard label={`${month}월 매출`} value={formatKRW(mSales)} sub={`${mSalesCnt}건`} color="#2563eb"
            delta={mSales - pSales} prevLabel={`${prevMonth}월`} prevValue={pSales} />
          <KpiCard label={`${month}월 매입`} value={formatKRW(mPurchase)} sub={`${mPurchaseCnt}건`} color="#d97706"
            delta={mPurchase - pPurchase} prevLabel={`${prevMonth}월`} prevValue={pPurchase} />
          <KpiCard label={`${month}월 외주인건비`} value={formatKRW(mLabor)} sub={`${mLaborCnt}건`} color="#7c3aed"
            delta={mLabor - pLabor} prevLabel={`${prevMonth}월`} prevValue={pLabor} />
          <KpiCard label={`${month}월 고정비`} value={formatKRW(fixedTotal)}
            sub={fixedCount > 0 ? `${fixedCount}건` : '없음'} color="#0891b2"
            delta={fixedTotal - prevFixedTotal} prevLabel={`${prevMonth}월`} prevValue={prevFixedTotal} />
          <KpiCard
            label={`${month}월 순이익`} value={formatKRW(mProfit)}
            sub={mProfit >= 0 ? '흑자' : '적자'}
            color={mProfit >= 0 ? '#059669' : '#dc2626'}
            delta={mProfit - pProfit} prevLabel={`${prevMonth}월`} prevValue={pProfit}
          />
        </div>
      </div>

      {/* ── 차트 Row ─────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(300px, 380px)', gap: 20, marginBottom: 20 }}>
        {/* 월별 추이 */}
        <div style={cardStyle}>
          <h3 style={cardTitle}>
            {year}년 월별 매출·매입 추이
            <span style={{ ...badgeStyle, marginLeft: 8 }}>{vatLabel}</span>
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="gSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gPurchase" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gLabor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `${(v/10000).toFixed(0)}만`} />
              <Tooltip formatter={(v) => [`${formatKRW(v)}원`, '']} />
              <Area type="monotone" dataKey="매출" stroke="#3b82f6" fill="url(#gSales)" strokeWidth={2} />
              <Area type="monotone" dataKey="매입" stroke="#f59e0b" fill="url(#gPurchase)" strokeWidth={2} />
              <Area type="monotone" dataKey="외주인건비" stroke="#8b5cf6" fill="url(#gLabor)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* 거래처 파이 */}
        <div style={cardStyle}>
          <h3 style={cardTitle}>
            거래처별 매출 비중
            <span style={{ ...badgeStyle, marginLeft: 8 }}>{year}년</span>
          </h3>
          {clientSalesData.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', paddingTop: 60, fontSize: 13 }}>데이터 없음</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={clientSalesData} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" outerRadius={80}
                  label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}
                  labelLine={false} fontSize={11}
                >
                  {clientSalesData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => [`${formatKRW(v)}원`, '']} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 거래처 바 차트 */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <h3 style={cardTitle}>
          거래처별 매출 순위
          <span style={{ ...badgeStyle, marginLeft: 8 }}>{year}년</span>
        </h3>
        {clientSalesData.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', paddingTop: 20, fontSize: 13 }}>데이터 없음</div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(160, clientSalesData.length * 30)}>
            <BarChart data={clientSalesData} layout="vertical" margin={{ top: 0, right: 30, left: 80, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `${(v/10000).toFixed(0)}만`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} width={75} />
              <Tooltip formatter={(v) => [`${formatKRW(v)}원`, '매출']} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18}>
                {clientSalesData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── 최근 거래 7건 ──────────────────────────── */}
      <div style={cardStyle}>
        <h3 style={{ ...cardTitle, marginBottom: 12 }}>🕐 최근 거래</h3>
        {recentTx.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px 0', fontSize: 13 }}>데이터 없음</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                {['날짜','거래처','적요','유형','금액','결제'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentTx.map((tx, i) => {
                const txAmt = exVat ? Number(tx.supply_amount) : Number(tx.total_amount)
                const isPaid   = tx.payment_status === '결제완료' || tx.payment_status === '지급완료'
                const isUnpaid = tx.payment_status === '미수금'   || tx.payment_status === '미지급'
                return (
                  <tr key={tx.id} style={{ borderBottom: '1px solid #f8fafc', background: i % 2 ? '#fafafa' : '#fff' }}>
                    <td style={{ padding: '10px 10px', color: '#64748b', whiteSpace: 'nowrap' }}>{tx.transaction_date}</td>
                    <td style={{ padding: '10px 10px', fontWeight: 500, color: '#374151' }}>{tx.clients?.name || '—'}</td>
                    <td style={{ padding: '10px 10px', color: '#64748b', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description || '—'}</td>
                    <td style={{ padding: '10px 10px' }}>
                      <span style={{
                        background: TYPE_BG[tx.type], color: TYPE_COLOR[tx.type],
                        borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600,
                      }}>{tx.type}</span>
                    </td>
                    <td style={{ padding: '10px 10px', fontWeight: 600, color: TYPE_COLOR[tx.type], textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {formatKRW(txAmt)}원
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      <span style={{
                        borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600,
                        background: isPaid ? '#f0fdf4' : isUnpaid ? '#fef2f2' : '#f8fafc',
                        color: isPaid ? '#059669' : isUnpaid ? '#dc2626' : '#94a3b8',
                      }}>
                        {tx.payment_status || '—'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function SectionLabel({ title, badge }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>{title}</span>
      {badge && <span style={badgeStyle}>{badge}</span>}
    </div>
  )
}

function KpiCard({ label, value, sub, color, large, delta, prevLabel, prevValue }) {
  const hasDelta = delta !== undefined && prevLabel
  const isUp   = delta > 0
  const isFlat = delta === 0

  return (
    <div style={{
      background: '#fff', borderRadius: 14,
      padding: large ? '22px 24px' : '18px 20px',
      border: '1px solid #e2e8f0',
      borderTop: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500, marginBottom: 8 }}>{label}</div>
      <div style={{
        fontSize: large ? 20 : 18, fontWeight: 700, color, marginBottom: 4,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{value}원</div>
      <div style={{ fontSize: 12, color: '#64748b' }}>{sub}</div>
      {hasDelta && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 3, marginTop: 8,
          paddingTop: 8, borderTop: '1px dashed #f1f5f9', fontSize: 11, flexWrap: 'wrap',
        }}>
          <span style={{ color: isFlat ? '#94a3b8' : isUp ? '#059669' : '#dc2626', fontWeight: 600 }}>
            {isFlat ? '─' : isUp ? '▲' : '▼'} {isFlat ? '변동없음' : `${formatKRW(Math.abs(delta))}원`}
          </span>
          <span style={{ color: '#cbd5e1' }}>|</span>
          <span style={{ color: '#94a3b8' }}>vs {prevLabel} · {formatKRW(prevValue)}원</span>
        </div>
      )}
    </div>
  )
}

const selStyle = {
  padding: '7px 12px', borderRadius: 8, border: '1px solid #e2e8f0',
  fontSize: 14, color: '#475569', cursor: 'pointer', background: '#fff',
}

const badgeStyle = {
  fontSize: 11, fontWeight: 400, color: '#94a3b8',
  background: '#f1f5f9', padding: '2px 8px', borderRadius: 10,
}

const cardStyle = {
  background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid #e2e8f0',
}

const cardTitle = {
  fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 16,
  display: 'flex', alignItems: 'center',
}
