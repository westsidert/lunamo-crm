import { useState, useEffect, useMemo } from 'react'
import { getCrew } from '../lib/crew'
import { formatKRW } from '../lib/utils'
import useIsMobile from '../lib/useIsMobile'
import {
  calcIncomeTax, calcLocalTax,
  getLaborTransactions, linkTransactionCrew, getTaxFilings, upsertTaxFiling,
  filingDeadline, statementDeadline, DEFAULT_BIZ_CODE, currentFilingPeriod,
} from '../lib/withholding'

const PURPLE = '#7c3aed'

const lastPeriods = (n) => {
  const out = []
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1) // 전월부터
  for (let i = 0; i < n; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    d.setMonth(d.getMonth() - 1)
  }
  return out
}

const periodLabel = (p) => {
  const [y, m] = p.split('-')
  return `${y}년 ${parseInt(m)}월`
}

const extractName = (item) => {
  const s = item || ''
  const idx = s.indexOf(' (')
  return (idx > 0 ? s.slice(0, idx) : s).trim()
}

const maskRrn = (rrn) => {
  const digits = (rrn || '').replace(/\D/g, '')
  if (digits.length < 7) return rrn || ''
  return digits.slice(0, 6) + '-●●●●●●●'
}

const STEP_KEYS = ['step_withholding', 'step_statement', 'step_local', 'step_paid']

export default function WithholdingTax() {
  const isMobile = useIsMobile()
  const [allTx, setAllTx] = useState([])
  const [crew, setCrew] = useState([])
  const [filings, setFilings] = useState([])
  const [period, setPeriod] = useState(currentFilingPeriod())
  const [loading, setLoading] = useState(true)
  const [guideOpen, setGuideOpen] = useState(null)
  const [revealKey, setRevealKey] = useState(null)
  const [merged, setMerged] = useState(() => new Set())  // 이번 신고에 합산할 미신고 과거 월

  useEffect(() => { load() }, [])
  useEffect(() => { setMerged(new Set()) }, [period])  // 귀속월 변경 시 합산 선택 초기화

  const load = async () => {
    setLoading(true)
    try {
      const [tx, cr, fl] = await Promise.all([getLaborTransactions(), getCrew(), getTaxFilings()])
      setAllTx(tx)
      setCrew(cr)
      setFilings(fl)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  // 마감이 지났는데 신고 기록이 전혀 없는 과거 지급월 (합산 신고 후보)
  const unfiledPast = useMemo(() => {
    const t0 = new Date(); t0.setHours(0, 0, 0, 0)
    const periods = [...new Set(allTx.map(t => t.transaction_date?.slice(0, 7)).filter(Boolean))]
    return periods
      .filter(p => p < period && filingDeadline(p) < t0)
      .filter(p => {
        const f = filings.find(x => x.period === p)
        return !f || STEP_KEYS.every(k => !f[k])
      })
      .sort()
  }, [allTx, filings, period])

  const toggleMerged = (p) => setMerged(prev => {
    const next = new Set(prev)
    next.has(p) ? next.delete(p) : next.add(p)
    return next
  })

  const monthTx = useMemo(
    () => allTx.filter(tx => {
      const m = tx.transaction_date?.slice(0, 7)
      return m === period || merged.has(m)
    }),
    [allTx, period, merged]
  )

  // 표시용 라벨: 합산 시 "6월+7월 지급분 합산"
  const periodsLabel = merged.size > 0
    ? [...merged, period].sort().map(p => `${parseInt(p.split('-')[1])}월`).join('+') + ' 지급분 합산'
    : `${periodLabel(period)} 지급분`

  // 인별 집계
  const people = useMemo(() => {
    const map = new Map()
    for (const tx of monthTx) {
      let crewObj = tx.crew || null
      const name = crewObj?.name || extractName(tx.item)
      if (!crewObj) crewObj = crew.find(c => c.name === name) || null
      const key = crewObj ? `c:${crewObj.id}` : `n:${name}`
      if (!map.has(key)) map.set(key, { key, name, crew: crewObj, txs: [] })
      map.get(key).txs.push(tx)
    }
    return [...map.values()].map(p => {
      const amount = p.txs.reduce((s, t) => s + Number(t.supply_amount || 0), 0)
      const incomeTax = p.txs.reduce((s, t) => s + calcIncomeTax(t.supply_amount), 0)
      const localTax = p.txs.reduce((s, t) => s + calcLocalTax(t.supply_amount), 0)
      const stored = p.txs.reduce((s, t) => s + Number(t.withholding_tax || 0), 0)
      const unlinked = p.txs.filter(t => !t.crew_id)
      const months = [...new Set(p.txs.map(t => t.transaction_date?.slice(0, 7)))].sort()
      return {
        ...p, amount, incomeTax, localTax, stored, months,
        mismatch: stored !== incomeTax + localTax,
        unlinked,
      }
    }).sort((a, b) => b.amount - a.amount)
  }, [monthTx, crew])

  const totals = useMemo(() => ({
    count: people.length,
    amount: people.reduce((s, p) => s + p.amount, 0),
    incomeTax: people.reduce((s, p) => s + p.incomeTax, 0),
    localTax: people.reduce((s, p) => s + p.localTax, 0),
  }), [people])

  const filing = filings.find(f => f.period === period) || {}
  const doneCount = STEP_KEYS.filter(k => filing[k]).length

  // 경고 수집
  const noRrn = people.filter(p => p.crew && !(p.crew.rrn || '').trim())
  const noCrew = people.filter(p => !p.crew)
  const mismatches = people.filter(p => p.mismatch)

  const deadline = filingDeadline(period)
  const stmtDeadline = statementDeadline(period)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const daysLeft = Math.ceil((deadline - today) / 86400000)

  const toggleStep = async (key) => {
    const next = !filing[key]
    try {
      const steps = {
        step_withholding: !!filing.step_withholding,
        step_statement: !!filing.step_statement,
        step_local: !!filing.step_local,
        step_paid: !!filing.step_paid,
        [key]: next,
      }
      const snapshot = {
        people: totals.count, amount: totals.amount,
        income_tax: totals.incomeTax, local_tax: totals.localTax,
        ...(merged.size > 0 ? { merged_periods: [...merged].sort() } : {}),
      }
      const savedList = [await upsertTaxFiling(period, { ...steps, snapshot })]
      // 합산 신고 대상 과거 월도 같은 진행 상태 + 합산 메모로 기록
      for (const mp of [...merged].sort()) {
        savedList.push(await upsertTaxFiling(mp, {
          ...steps,
          memo: `${periodLabel(period)} 지급분에 합산 신고`,
          snapshot: { merged_into: period },
        }))
      }
      setFilings(prev => {
        const savedPeriods = new Set(savedList.map(s => s.period))
        const rest = prev.filter(f => !savedPeriods.has(f.period))
        return [...rest, ...savedList].sort((a, b) => b.period.localeCompare(a.period))
      })
    } catch (e) { alert('저장 실패: ' + e.message) }
  }

  const linkPerson = async (person, crewId) => {
    if (!crewId) return
    try {
      const targets = person.txs.filter(t => t.crew_id !== crewId)
      const updated = await Promise.all(targets.map(t => linkTransactionCrew(t.id, crewId)))
      setAllTx(prev => prev.map(t => updated.find(u => u.id === t.id) || t))
    } catch (e) { alert('연결 실패: ' + e.message) }
  }

  const downloadCsv = () => {
    const rows = [['성명', '주민등록번호', '업종코드', '귀속월', '지급액', '소득세(3%)', '지방소득세(0.3%)', '실지급액']]
    people.forEach(p => rows.push([
      p.name,
      p.crew?.rrn || '',
      p.crew?.biz_type_code || DEFAULT_BIZ_CODE,
      period,
      p.amount, p.incomeTax, p.localTax,
      p.amount - p.incomeTax - p.localTax,
    ]))
    const csv = '\uFEFF' + rows.map(r => r.join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `간이지급명세서_${period}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const hasData = monthTx.length > 0

  // 신고 이력 CSV: 지급이 있었던 모든 월의 집계 + 신고 진행 상태
  const downloadHistoryCsv = () => {
    const periods = [...new Set(allTx.map(t => t.transaction_date?.slice(0, 7)).filter(Boolean))].sort()
    const rows = [['귀속월', '인원', '총지급액', '소득세(3%)', '지방소득세(0.3%)', '원천세신고', '간이지급명세서', '지방세신고', '납부']]
    for (const p of periods) {
      const txs = allTx.filter(t => t.transaction_date?.startsWith(p))
      const names = new Set(txs.map(t => t.crew?.name || extractName(t.item)))
      const f = filings.find(x => x.period === p) || {}
      rows.push([
        p, names.size,
        txs.reduce((s, t) => s + Number(t.supply_amount || 0), 0),
        txs.reduce((s, t) => s + calcIncomeTax(t.supply_amount), 0),
        txs.reduce((s, t) => s + calcLocalTax(t.supply_amount), 0),
        f.step_withholding ? 'O' : 'X',
        f.step_statement ? 'O' : 'X',
        f.step_local ? 'O' : 'X',
        f.step_paid ? 'O' : 'X',
      ])
    }
    const csv = '\uFEFF' + rows.map(r => r.join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `원천세_신고이력_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // 신고 자료 인쇄 (브라우저 인쇄 대화상자에서 PDF 저장 가능)
  const printReport = () => {
    if (!hasData) return
    const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const num = (n) => Number(n).toLocaleString('ko-KR')
    const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>원천세 신고 자료 ${esc(period)}</title>
<style>
  body { font-family: -apple-system, 'Apple SD Gothic Neo', sans-serif; color: #0f172a; margin: 32px; font-size: 13px; }
  h1 { font-size: 19px; margin: 0 0 4px; }
  .sub { color: #64748b; font-size: 12px; margin-bottom: 20px; }
  h2 { font-size: 14px; margin: 22px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #7c3aed; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; font-size: 12px; }
  th { background: #f1f5f9; }
  td.r, th.r { text-align: right; }
  .note { color: #64748b; font-size: 11px; margin-top: 16px; line-height: 1.6; }
  @media print { body { margin: 12mm; } }
</style></head><body>
<h1>원천세 신고 자료 - ${esc(periodsLabel)}</h1>
<div class="sub">LUNAMO CRM · 출력일 ${new Date().toLocaleDateString('ko-KR')} · 신고 마감 ${deadline.getFullYear()}.${deadline.getMonth() + 1}.${deadline.getDate()}</div>

<h2>1. 홈택스 원천세 신고 (원천징수이행상황신고서 · 사업소득 A25 매월징수)</h2>
<table><tr><th>인원</th><th class="r">총지급금액 (3.3% 공제 전)</th><th class="r">소득세 등 (3%)</th></tr>
<tr><td>${totals.count}명</td><td class="r">${num(totals.amount)}원</td><td class="r">${num(totals.incomeTax)}원</td></tr></table>

<h2>2. 간이지급명세서 (거주자의 사업소득) - 인별 명세</h2>
<table>
<tr><th>성명</th><th>주민등록번호</th><th>업종코드</th><th class="r">지급액</th><th class="r">소득세(3%)</th><th class="r">지방소득세(0.3%)</th><th class="r">실지급액</th></tr>
${people.map(p => `<tr><td>${esc(p.name)}</td><td>${esc(p.crew?.rrn || '미등록')}</td><td>${esc(p.crew?.biz_type_code || DEFAULT_BIZ_CODE)}</td><td class="r">${num(p.amount)}</td><td class="r">${num(p.incomeTax)}</td><td class="r">${num(p.localTax)}</td><td class="r">${num(p.amount - p.incomeTax - p.localTax)}</td></tr>`).join('')}
<tr><th>합계 (${totals.count}명)</th><th></th><th></th><th class="r">${num(totals.amount)}</th><th class="r">${num(totals.incomeTax)}</th><th class="r">${num(totals.localTax)}</th><th class="r">${num(totals.amount - totals.incomeTax - totals.localTax)}</th></tr>
</table>

<h2>3. 위택스 지방소득세 특별징수</h2>
<table><tr><th>인원</th><th class="r">과세표준 (소득세 3% 금액)</th><th class="r">특별징수세액 (0.3%)</th></tr>
<tr><td>${totals.count}명</td><td class="r">${num(totals.incomeTax)}원</td><td class="r">${num(totals.localTax)}원</td></tr></table>

<div class="note">※ 세액은 소득세 3%, 지방소득세는 소득세의 10%로 각각 10원 미만 절사하여 건별 계산 후 합산. 홈택스·위택스 자동계산과 원단위 차이가 있으면 신고 화면 값 기준. 주민등록번호가 포함된 문서이므로 보관에 주의하세요.</div>
<script>window.onload = () => window.print()</script>
</body></html>`
    const w = window.open('', '_blank')
    if (!w) { alert('팝업이 차단되었습니다. 팝업을 허용해주세요.'); return }
    w.document.write(html)
    w.document.close()
  }

  return (
    <div style={{ padding: isMobile ? '18px 14px' : '28px 32px', maxWidth: 1100 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>원천세 신고 도우미</h1>
          <p style={{ color: '#64748b', marginTop: 4, fontSize: 13 }}>
            외주인건비 3.3% 원천세 · 간이지급명세서 · 지방소득세 신고를 위한 월별 집계
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={downloadHistoryCsv} style={{ ...btnSmall, padding: '8px 14px', fontSize: 13 }}>
            📄 이력 CSV
          </button>
          <button onClick={printReport} disabled={!hasData} style={{
            ...btnSmall, padding: '8px 14px', fontSize: 13,
            color: hasData ? PURPLE : '#cbd5e1', borderColor: hasData ? '#c4b5fd' : '#e2e8f0',
            cursor: hasData ? 'pointer' : 'not-allowed',
          }}>
            🖨 인쇄 (PDF 저장)
          </button>
          <select value={period} onChange={e => setPeriod(e.target.value)} style={{
            padding: '9px 14px', borderRadius: 8, border: '1px solid #e2e8f0',
            fontSize: 14, fontWeight: 600, color: '#0f172a', background: '#fff', cursor: 'pointer',
          }}>
            {lastPeriods(24).map(p => (
              <option key={p} value={p}>{periodLabel(p)} 지급분</option>
            ))}
          </select>
        </div>
      </div>

      {/* 마감 배너 */}
      <div style={{
        borderRadius: 12, padding: '14px 20px', marginBottom: 16,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
        background: doneCount === 4 ? '#f0fdf4' : (!hasData ? '#f8fafc' : daysLeft < 0 ? '#fef2f2' : '#faf5ff'),
        border: `1px solid ${doneCount === 4 ? '#bbf7d0' : (!hasData ? '#e2e8f0' : daysLeft < 0 ? '#fecaca' : '#e9d5ff')}`,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: doneCount === 4 ? '#16a34a' : (!hasData ? '#64748b' : daysLeft < 0 ? '#dc2626' : PURPLE) }}>
          {doneCount === 4
            ? `✅ ${periodsLabel} 신고 완료`
            : !hasData
              ? `${periodLabel(period)} 외주인건비 지급 내역 없음`
              : daysLeft >= 0
                ? `⏰ ${periodsLabel} 신고 마감 D-${daysLeft} (${deadline.getMonth() + 1}/${deadline.getDate()})`
                : `⚠️ 원천세·지방세 마감(${deadline.getMonth() + 1}/${deadline.getDate()}) 경과 - 미신고 시 가산세 발생`}
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>
          원천세·지방세: 다음달 10일 / 간이지급명세서: {stmtDeadline.getMonth() + 1}/{stmtDeadline.getDate()}까지 · 진행 {doneCount}/4
        </div>
      </div>

      {/* 미신고 과거 지급분 합산 패널 */}
      {unfiledPast.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>
            ⚠️ 신고하지 않은 과거 지급분이 있습니다
          </div>
          <div style={{ fontSize: 12, color: '#a16207', marginBottom: 10, lineHeight: 1.6 }}>
            체크하면 해당 월 지급분을 <b>{periodLabel(period)} 신고에 합산</b>해서 계산합니다
            (지급월을 이번 달로 보고 신고하는 실무 방식). 완료 체크 시 합산된 월도 함께 완료 처리됩니다.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {unfiledPast.map(p => {
              const txs = allTx.filter(t => t.transaction_date?.startsWith(p))
              const names = new Set(txs.map(t => t.crew?.name || extractName(t.item)))
              const amt = txs.reduce((s, t) => s + Number(t.supply_amount || 0), 0)
              const on = merged.has(p)
              return (
                <button key={p} onClick={() => toggleMerged(p)} style={{
                  display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                  padding: '8px 14px', borderRadius: 10, fontSize: 13,
                  border: `1.5px solid ${on ? '#d97706' : '#fde68a'}`,
                  background: on ? '#fef3c7' : '#fff',
                  color: '#92400e', fontWeight: on ? 700 : 500,
                }}>
                  <input type="checkbox" checked={on} readOnly style={{ width: 14, height: 14, pointerEvents: 'none' }} />
                  {periodLabel(p)} 지급분 · {names.size}명 · {formatKRW(amt)}원
                </button>
              )
            })}
          </div>
          {merged.size > 0 && (
            <div style={{ fontSize: 11, color: '#a16207', marginTop: 10 }}>
              ※ 원칙은 기한 후 신고(가산세)이며, 합산 신고는 지급 시기를 조정해 신고하는 방식입니다. 애매하면 세무사 확인을 권합니다.
            </div>
          )}
        </div>
      )}

      {/* 12개월 히스토리 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
        {lastPeriods(12).reverse().map(p => {
          const f = filings.find(x => x.period === p) || {}
          const done = STEP_KEYS.filter(k => f[k]).length
          const has = allTx.some(t => t.transaction_date?.startsWith(p))
          const past = filingDeadline(p) < today
          const color = !has ? '#e2e8f0' : done === 4 ? '#22c55e' : done > 0 ? '#f59e0b' : past ? '#ef4444' : '#c4b5fd'
          const label = !has ? '지급없음' : done === 4 ? '완료' : done > 0 ? `${done}/4` : past ? '미신고' : '대기'
          return (
            <button key={p} onClick={() => setPeriod(p)} title={`${periodLabel(p)}: ${label}`} style={{
              border: period === p ? `2px solid ${PURPLE}` : '1px solid #e2e8f0',
              background: '#fff', borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 52,
            }}>
              <span style={{ fontSize: 11, color: '#64748b' }}>{parseInt(p.split('-')[1])}월</span>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
            </button>
          )
        })}
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>불러오는 중...</div>
      ) : !hasData ? (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 48, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🧾</div>
          {periodLabel(period)}에 지급한 외주인건비가 없습니다.<br />
          <span style={{ fontSize: 12 }}>지급 내역이 없는 달은 일반적으로 원천세 신고 대상이 아닙니다. 거래 내역에서 외주인건비를 입력하면 여기에 자동 집계됩니다.</span>
        </div>
      ) : (
        <>
          {/* 경고 */}
          {(noCrew.length > 0 || noRrn.length > 0 || mismatches.length > 0) && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '14px 18px', marginBottom: 20, fontSize: 13, color: '#92400e' }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>⚠️ 신고 전 확인 필요</div>
              {noCrew.length > 0 && (
                <div style={{ marginBottom: 4 }}>· 인력 미연결 {noCrew.length}명 ({noCrew.map(p => p.name).join(', ')}) - 아래 표에서 인력을 연결하거나 인력 페이지에 등록하세요</div>
              )}
              {noRrn.length > 0 && (
                <div style={{ marginBottom: 4 }}>· 주민등록번호 미등록 {noRrn.length}명 ({noRrn.map(p => p.name).join(', ')}) - 간이지급명세서 제출에 필요합니다. 인력 페이지에서 등록하세요</div>
              )}
              {mismatches.length > 0 && (
                <div>· 원천세 입력값과 계산값(3% + 0.3%, 10원 미만 절사) 불일치 {mismatches.length}명 - 거래 내역에서 금액을 확인하세요. 신고 화면의 세액은 계산값 기준입니다</div>
              )}
            </div>
          )}

          {/* STEP 1 */}
          <StepCard
            no={1} title="홈택스 원천세 신고" badge="원천징수이행상황신고서 · 사업소득 A25"
            deadlineText={`~${deadline.getMonth() + 1}/${deadline.getDate()}`}
            done={!!filing.step_withholding} onToggle={() => toggleStep('step_withholding')}
            guideOpen={guideOpen === 1} onGuide={() => setGuideOpen(guideOpen === 1 ? null : 1)}
            guide={[
              '홈택스 로그인 → 세금신고 → 원천세 신고 → 일반신고 → 정기신고',
              '사업자(주민)등록번호 확인 → 소득 종류에서 [사업소득] 체크 → 저장 후 다음',
              '사업소득 [매월징수(A25)] 행에 아래 3개 값 입력: 인원 / 총지급금액 / 소득세 등',
              '이후 화면은 체크 없이 저장 후 다음 → 금액 확인 → 신고서 제출 → 소득자료 제출',
            ]}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <BigValue label="인원" value={totals.count} suffix="명" copyValue={totals.count} />
              <BigValue label="총지급금액 (3.3% 공제 전)" value={formatKRW(totals.amount)} suffix="원" copyValue={totals.amount} />
              <BigValue label="소득세 등 (3%)" value={formatKRW(totals.incomeTax)} suffix="원" copyValue={totals.incomeTax} highlight />
            </div>
            <p style={noteStyle}>💡 '소득세 등' 칸에는 3% 소득세만 입력합니다. 0.3% 지방소득세는 STEP 3 위택스에서 별도 신고합니다.</p>
          </StepCard>

          {/* STEP 2 */}
          <StepCard
            no={2} title="간이지급명세서 (거주자의 사업소득)" badge="인별 명세 제출"
            deadlineText={`~${stmtDeadline.getMonth() + 1}/${stmtDeadline.getDate()}`}
            done={!!filing.step_statement} onToggle={() => toggleStep('step_statement')}
            guideOpen={guideOpen === 2} onGuide={() => setGuideOpen(guideOpen === 2 ? null : 2)}
            guide={[
              '홈택스 검색창에 [간이지급명세서] 검색 → 간이지급명세서(거주자의 사업소득) 선택',
              '전월 신고 이력이 있으면 [미리채움], 처음이면 [신규작성] → 상세내역 작성하기',
              '인별로 업종구분·귀속월·주민등록번호·성명·지급액 입력 (세액은 자동계산)',
              '매월 누락 없이 제출하면 연 1회 지급명세서 제출이 면제됩니다',
            ]}
            extra={<button onClick={downloadCsv} style={{ ...btnSmall, color: PURPLE, borderColor: '#c4b5fd' }}>⬇ CSV 다운로드</button>}
          >
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['성명', '주민등록번호', '업종코드', '지급액', '소득세 (3%)', '지방소득세 (0.3%)', '실지급액', '상태'].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {people.map((p, idx) => {
                    const rrnDigits = (p.crew?.rrn || '').replace(/\D/g, '')
                    const revealed = revealKey === p.key
                    return (
                      <tr key={p.key} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 1 ? '#fafafa' : '#fff' }}>
                        <td style={{ ...tdStyle, fontWeight: 700 }}>
                          {p.name}
                          {p.txs.length > 1 && <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: 11 }}> ({p.txs.length}건)</span>}
                          {merged.size > 0 && (
                            <span style={{ fontWeight: 600, color: '#d97706', fontSize: 10, marginLeft: 4 }}>
                              {p.months.map(m => `${parseInt(m.split('-')[1])}월`).join('·')}
                            </span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          {p.crew ? (
                            rrnDigits ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{revealed ? p.crew.rrn : maskRrn(p.crew.rrn)}</span>
                                <button onClick={() => setRevealKey(revealed ? null : p.key)} style={iconBtn} title={revealed ? '숨기기' : '보기'}>{revealed ? '🙈' : '👁'}</button>
                                <CopyBtn value={rrnDigits} />
                              </span>
                            ) : <span style={{ color: '#dc2626', fontSize: 12 }}>미등록</span>
                          ) : <span style={{ color: '#dc2626', fontSize: 12 }}>인력 미연결</span>}
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.crew?.biz_type_code || DEFAULT_BIZ_CODE}</span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{formatKRW(p.amount)} <CopyBtn value={p.amount} /></td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: PURPLE }}>{formatKRW(p.incomeTax)} <CopyBtn value={p.incomeTax} /></td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: PURPLE }}>{formatKRW(p.localTax)} <CopyBtn value={p.localTax} /></td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{formatKRW(p.amount - p.incomeTax - p.localTax)}</td>
                        <td style={tdStyle}>
                          {!p.crew ? (
                            <select defaultValue="" onChange={e => linkPerson(p, e.target.value)} style={{ ...btnSmall, padding: '3px 6px', maxWidth: 120 }}>
                              <option value="" disabled>인력 연결...</option>
                              {crew.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          ) : p.unlinked.length > 0 ? (
                            <button onClick={() => linkPerson(p, p.crew.id)} style={{ ...btnSmall, color: '#0891b2', borderColor: '#a5f3fc' }}>
                              연결 저장
                            </button>
                          ) : p.mismatch ? (
                            <span title={`입력된 원천세 ${formatKRW(p.stored)}원 ≠ 계산값 ${formatKRW(p.incomeTax + p.localTax)}원`}
                              style={{ fontSize: 11, color: '#d97706', fontWeight: 600 }}>세액 불일치</span>
                          ) : (
                            <span style={{ fontSize: 11, color: '#16a34a' }}>✓</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#faf5ff', borderTop: '2px solid #e9d5ff' }}>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>합계 ({totals.count}명)</td>
                    <td style={tdStyle} />
                    <td style={tdStyle} />
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{formatKRW(totals.amount)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: PURPLE }}>{formatKRW(totals.incomeTax)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: PURPLE }}>{formatKRW(totals.localTax)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{formatKRW(totals.amount - totals.incomeTax - totals.localTax)}</td>
                    <td style={tdStyle} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </StepCard>

          {/* STEP 3 */}
          <StepCard
            no={3} title="위택스 지방소득세 신고" badge="특별징수 (0.3%)"
            deadlineText={`~${deadline.getMonth() + 1}/${deadline.getDate()}`}
            done={!!filing.step_local} onToggle={() => toggleStep('step_local')}
            guideOpen={guideOpen === 3} onGuide={() => setGuideOpen(guideOpen === 3 ? null : 3)}
            guide={[
              '위택스(wetax.go.kr) 로그인 → 신고 → 특별징수 → 한 건 신고',
              '사업장번호 조회 체크 → 휴대폰 번호 입력 → 다음',
              '사업소득란에 인원 / 과세표준(= 소득세 3% 금액) 입력 → 특별징수세액(0.3%) 자동계산',
              '가감조정 없으면 다음 → 다음 → 금액 확인 후 제출',
            ]}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <BigValue label="인원" value={totals.count} suffix="명" copyValue={totals.count} />
              <BigValue label="과세표준 (소득세 3% 금액)" value={formatKRW(totals.incomeTax)} suffix="원" copyValue={totals.incomeTax} highlight />
              <BigValue label="특별징수세액 (0.3%, 자동계산 대조용)" value={formatKRW(totals.localTax)} suffix="원" copyValue={totals.localTax} />
            </div>
            <p style={noteStyle}>💡 과세표준에는 지급액이 아니라 STEP 1에서 신고한 소득세(3%) 금액을 입력합니다. 자동계산된 세액이 위 값과 다르면 절사 방식 차이이니 위택스 값을 따르세요.</p>
          </StepCard>

          {/* STEP 4 */}
          <StepCard
            no={4} title="납부" badge="홈택스(국세) + 위택스(지방세)"
            deadlineText={`~${deadline.getMonth() + 1}/${deadline.getDate()}`}
            done={!!filing.step_paid} onToggle={() => toggleStep('step_paid')}
            guideOpen={guideOpen === 4} onGuide={() => setGuideOpen(guideOpen === 4 ? null : 4)}
            guide={[
              '원천세(국세): 홈택스 신고 직후 납부하거나, 은행 앱 공과금 → 국세 납부에서 사업자번호로 조회 후 납부',
              '지방소득세: 위택스에서 바로 납부하거나, 은행 앱 공과금 → 지방세 납부에서 조회 후 납부',
            ]}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <BigValue label="원천세 납부액 (소득세 3%)" value={formatKRW(totals.incomeTax)} suffix="원" copyValue={totals.incomeTax} />
              <BigValue label="지방소득세 납부액 (0.3%)" value={formatKRW(totals.localTax)} suffix="원" copyValue={totals.localTax} />
            </div>
          </StepCard>

          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 8, lineHeight: 1.7 }}>
            ※ 세액은 소득세 3%, 지방소득세는 소득세의 10%로 각각 10원 미만 절사하여 건별 계산 후 합산한 값입니다.
            홈택스·위택스 자동계산과 원단위 차이가 있으면 신고 화면의 값을 기준으로 하세요.
            간이지급명세서를 매월 누락 없이 제출하면 사업소득 연간 지급명세서 제출이 면제됩니다.
            세부 사항은 세무사 확인을 권장합니다.
          </p>
        </>
      )}
    </div>
  )
}

// ── 컴포넌트 ────────────────────────────────────────────
function StepCard({ no, title, badge, deadlineText, done, onToggle, guide, guideOpen, onGuide, extra, children }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: `1px solid ${done ? '#bbf7d0' : '#e2e8f0'}`,
      marginBottom: 16, overflow: 'hidden',
    }}>
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid #f1f5f9',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
        background: done ? '#f0fdf4' : '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{
            width: 26, height: 26, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: done ? '#22c55e' : PURPLE, color: '#fff', fontSize: 13, fontWeight: 700,
          }}>{done ? '✓' : no}</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{title}</span>
          <span style={{ fontSize: 11, color: '#94a3b8', background: '#f1f5f9', padding: '2px 8px', borderRadius: 20 }}>{badge}</span>
          <span style={{ fontSize: 11, color: '#d97706', fontWeight: 600 }}>{deadlineText}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {extra}
          <button onClick={onGuide} style={{ ...btnSmall, color: '#64748b' }}>{guideOpen ? '가이드 접기' : '📖 가이드'}</button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: done ? '#16a34a' : '#64748b' }}>
            <input type="checkbox" checked={done} onChange={onToggle} style={{ width: 16, height: 16, cursor: 'pointer' }} />
            완료
          </label>
        </div>
      </div>
      {guideOpen && (
        <ol style={{ margin: 0, padding: '12px 20px 12px 48px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', fontSize: 13, color: '#475569', lineHeight: 2 }}>
          {guide.map((g, i) => <li key={i}>{g}</li>)}
        </ol>
      )}
      <div style={{ padding: '18px 20px' }}>
        {children}
      </div>
    </div>
  )
}

function BigValue({ label, value, suffix, copyValue, highlight }) {
  return (
    <div style={{
      background: highlight ? '#faf5ff' : '#f8fafc',
      border: `1px solid ${highlight ? '#e9d5ff' : '#e2e8f0'}`,
      borderRadius: 10, padding: '14px 16px',
    }}>
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: highlight ? PURPLE : '#0f172a' }}>{value}</span>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{suffix}</span>
        <CopyBtn value={copyValue} />
      </div>
    </div>
  )
}

function CopyBtn({ value }) {
  const [copied, setCopied] = useState(false)
  const doCopy = async (e) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(String(value))
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch { alert('복사 실패 - 직접 입력해주세요: ' + value) }
  }
  return (
    <button onClick={doCopy} title="복사" style={{
      background: copied ? '#dcfce7' : '#f1f5f9', border: 'none', borderRadius: 5,
      padding: '2px 7px', fontSize: 11, cursor: 'pointer', color: copied ? '#16a34a' : '#64748b',
      fontWeight: 600, verticalAlign: 'middle',
    }}>
      {copied ? '✓ 복사됨' : '복사'}
    </button>
  )
}

const thStyle = { padding: '10px 12px', textAlign: 'left', fontSize: 12, color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }
const tdStyle = { padding: '10px 12px', fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }
const btnSmall = { padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#475569' }
const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: '0 2px', color: '#94a3b8' }
const noteStyle = { fontSize: 12, color: '#94a3b8', marginTop: 12, lineHeight: 1.6 }
