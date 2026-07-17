// 기간 프리셋 계산 (PeriodSelect와 공용)
const pad = (n) => String(n).padStart(2, '0')
const monthRange = (y, m1, m2 = m1) => ({
  from: `${y}-${pad(m1)}-01`,
  to: `${y}-${pad(m2)}-${new Date(y, m2, 0).getDate()}`,
})

export const PRESETS = [
  { key: 'thisMonth', label: '이번 달' },
  { key: 'prevMonth', label: '전월' },
  { key: 'last3', label: '최근 3개월' },
  { key: 'q1', label: '1분기' },
  { key: 'q2', label: '2분기' },
  { key: 'q3', label: '3분기' },
  { key: 'q4', label: '4분기' },
  { key: 'half1', label: '상반기' },
  { key: 'half2', label: '하반기' },
  { key: 'thisYear', label: '올해' },
  { key: 'lastYear', label: '작년' },
]

export const presetRange = (key) => {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  switch (key) {
    case 'thisMonth': return monthRange(y, m)
    case 'prevMonth': return m === 1 ? monthRange(y - 1, 12) : monthRange(y, m - 1)
    case 'last3': {
      const start = new Date(y, now.getMonth() - 2, 1)
      return { from: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-01`, to: monthRange(y, m).to }
    }
    case 'q1': return monthRange(y, 1, 3)
    case 'q2': return monthRange(y, 4, 6)
    case 'q3': return monthRange(y, 7, 9)
    case 'q4': return monthRange(y, 10, 12)
    case 'half1': return monthRange(y, 1, 6)
    case 'half2': return monthRange(y, 7, 12)
    case 'thisYear': return monthRange(y, 1, 12)
    case 'lastYear': return monthRange(y - 1, 1, 12)
    default: return null
  }
}

export const valueToRange = (value) => {
  if (!value) return null
  if (value.startsWith('preset:')) return presetRange(value.slice(7))
  if (value.startsWith('month:')) {
    const [yy, mm] = value.slice(6).split('-').map(Number)
    return monthRange(yy, mm)
  }
  return null
}
