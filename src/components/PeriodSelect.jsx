import { PRESETS } from '../lib/period'

// 기간 프리셋 선택 (이번 달/전월/분기/반기/연간 + 데이터 존재 월 직접 선택)
// value: '' | 'preset:키' | 'month:YYYY-MM' — 범위 계산은 lib/period.js valueToRange 사용
export default function PeriodSelect({ value, onChange, monthOptions = [], style }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={style}>
      <option value="">전체 기간</option>
      {PRESETS.map(p => (
        <option key={p.key} value={`preset:${p.key}`}>{p.label}</option>
      ))}
      {monthOptions.length > 0 && <option disabled>── 월 선택 ──</option>}
      {monthOptions.map(m => {
        const [yy, mm] = m.split('-')
        return <option key={m} value={`month:${m}`}>{yy}년 {parseInt(mm)}월</option>
      })}
    </select>
  )
}
