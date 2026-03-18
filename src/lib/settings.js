import { supabase } from './supabase'

const KEYS = ['company_logo', 'company_stamp', 'comp_companies']

// 기존 localStorage 데이터를 Supabase로 1회 이전
export const migrateToSupabase = async () => {
  if (localStorage.getItem('settings_migrated')) return
  const entries = KEYS
    .map(key => ({ key, value: localStorage.getItem(key) }))
    .filter(e => e.value)
  if (entries.length > 0) {
    await supabase.from('settings').upsert(entries)
  }
  localStorage.setItem('settings_migrated', '1')
}

// Supabase → localStorage 동기화
export const syncFromSupabase = async () => {
  const { data } = await supabase.from('settings').select('*').in('key', KEYS)
  if (data) {
    data.forEach(({ key, value }) => {
      if (value) localStorage.setItem(key, value)
      else localStorage.removeItem(key)
    })
  }
}

// 저장: Supabase + localStorage 동시
export const saveSetting = async (key, value) => {
  if (value) {
    localStorage.setItem(key, value)
    await supabase.from('settings').upsert({ key, value })
  } else {
    localStorage.removeItem(key)
    await supabase.from('settings').delete().eq('key', key)
  }
}
