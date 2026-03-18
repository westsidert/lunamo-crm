export const formatKRW = (n) => {
  if (!n && n !== 0) return '0'
  return Number(n).toLocaleString('ko-KR')
}

export const formatDate = (d) => {
  if (!d) return ''
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export const calcVat = (supply) => Math.round(supply * 0.1)

export const thisYear = () => new Date().getFullYear()
export const thisMonth = () => new Date().getMonth() + 1

export const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

export const STATUS_COLORS = {
  '진행중': 'bg-blue-100 text-blue-700',
  '완료': 'bg-green-100 text-green-700',
  '보류': 'bg-yellow-100 text-yellow-700',
  '취소': 'bg-red-100 text-red-700',
}

export const PAYMENT_COLORS = {
  '미수금': 'bg-red-50 text-red-600',
  '수금완료': 'bg-green-50 text-green-700',
  '미지급': 'bg-orange-50 text-orange-600',
  '지급완료': 'bg-slate-100 text-slate-600',
}
