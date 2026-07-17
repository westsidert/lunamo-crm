// 공용 CSV 다운로드 (엑셀 호환 BOM 포함, 쉼표/따옴표/줄바꿈 escape)
export const downloadCsvRows = (filename, rows) => {
  const escapeCell = (cell) => {
    const s = String(cell ?? '')
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const csv = '\uFEFF' + rows.map(r => r.map(escapeCell).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
