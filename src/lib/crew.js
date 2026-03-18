import { supabase } from './supabase'

export const getCrew = async () => {
  const { data, error } = await supabase.from('crew').select('*').order('created_at')
  if (error) throw error
  return data
}

export const createCrew = async (member) => {
  const { data, error } = await supabase.from('crew').insert(member).select().single()
  if (error) throw error
  return data
}

export const updateCrew = async (id, member) => {
  const { data, error } = await supabase.from('crew').update(member).eq('id', id).select().single()
  if (error) throw error
  return data
}

export const deleteCrew = async (id) => {
  const { error } = await supabase.from('crew').delete().eq('id', id)
  if (error) throw error
}
