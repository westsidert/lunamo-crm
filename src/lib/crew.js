const CREW_KEY = 'crew_list'

export const getCrew = () => {
  try { return JSON.parse(localStorage.getItem(CREW_KEY) || '[]') }
  catch { return [] }
}

export const saveCrew = (list) => localStorage.setItem(CREW_KEY, JSON.stringify(list))
