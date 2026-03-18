import { supabase } from './supabase'

// ── 거래처 ──────────────────────────────────────
export const getClients = async () => {
  const { data, error } = await supabase
    .from('clients').select('*').order('name')
  if (error) throw error
  return data
}

export const createClient = async (client) => {
  const { data, error } = await supabase
    .from('clients').insert(client).select().single()
  if (error) throw error
  return data
}

export const updateClient = async (id, client) => {
  const { data, error } = await supabase
    .from('clients').update(client).eq('id', id).select().single()
  if (error) throw error
  return data
}

export const deleteClient = async (id) => {
  const { error } = await supabase.from('clients').delete().eq('id', id)
  if (error) throw error
}

// ── 프로젝트 ─────────────────────────────────────
export const getProjects = async () => {
  const { data, error } = await supabase
    .from('projects')
    .select('*, clients(name)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export const createProject = async (project) => {
  const { data, error } = await supabase
    .from('projects').insert(project).select('*, clients(name)').single()
  if (error) throw error
  return data
}

export const updateProject = async (id, project) => {
  const { data, error } = await supabase
    .from('projects').update(project).eq('id', id).select('*, clients(name)').single()
  if (error) throw error
  return data
}

export const deleteProject = async (id) => {
  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) throw error
}

// ── 거래 (매입/매출) ──────────────────────────────
export const getTransactions = async (filters = {}) => {
  let query = supabase
    .from('transactions')
    .select('*, clients(name), projects(name)')
    .order('transaction_date', { ascending: false })

  if (filters.type) query = query.eq('type', filters.type)
  if (filters.client_id) query = query.eq('client_id', filters.client_id)
  if (filters.project_id) query = query.eq('project_id', filters.project_id)
  if (filters.from) query = query.gte('transaction_date', filters.from)
  if (filters.to) query = query.lte('transaction_date', filters.to)

  const { data, error } = await query
  if (error) throw error
  return data
}

export const createTransaction = async (tx) => {
  const { data, error } = await supabase
    .from('transactions')
    .insert(tx)
    .select('*, clients(name), projects(name)')
    .single()
  if (error) throw error
  return data
}

export const updateTransaction = async (id, tx) => {
  const { data, error } = await supabase
    .from('transactions').update(tx).eq('id', id)
    .select('*, clients(name), projects(name)').single()
  if (error) throw error
  return data
}

export const deleteTransaction = async (id) => {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw error
}

export const createTransactions = async (txList) => {
  const { data, error } = await supabase
    .from('transactions')
    .insert(txList)
    .select('*, clients(name), projects(name)')
  if (error) throw error
  return data
}

// ── 견적서 ────────────────────────────────────────
export const getQuotes = async () => {
  const { data, error } = await supabase
    .from('quotes')
    .select('*, clients(name), quote_items(*)')
    .order('quote_date', { ascending: false })
  if (error) throw error
  return data
}

export const createQuote = async ({ items, ...quote }) => {
  const { data: q, error: qe } = await supabase
    .from('quotes').insert(quote).select().single()
  if (qe) throw qe
  if (items.length > 0) {
    const { error: ie } = await supabase.from('quote_items').insert(
      items.map((item, i) => ({ ...item, quote_id: q.id, sort_order: i }))
    )
    if (ie) throw ie
  }
  return q
}

export const updateQuote = async (id, { items, ...quote }) => {
  const { data: q, error: qe } = await supabase
    .from('quotes').update(quote).eq('id', id).select().single()
  if (qe) throw qe
  await supabase.from('quote_items').delete().eq('quote_id', id)
  if (items.length > 0) {
    const { error: ie } = await supabase.from('quote_items').insert(
      items.map((item, i) => ({ ...item, quote_id: id, sort_order: i }))
    )
    if (ie) throw ie
  }
  return q
}

export const deleteQuote = async (id) => {
  const { error } = await supabase.from('quotes').delete().eq('id', id)
  if (error) throw error
}

// ── 대시보드 통계 ─────────────────────────────────
export const getDashboardStats = async (year, month) => {
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

  const { data, error } = await supabase
    .from('transactions')
    .select('type, supply_amount, vat, total_amount, transaction_date, clients(name)')
    .gte('transaction_date', from)
    .lte('transaction_date', to)

  if (error) throw error
  return data
}

export const getUnpaidSales = async () => {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, type, total_amount, supply_amount, transaction_date, clients(name), memo, payment_status')
    .eq('type', '매출')
    .eq('payment_status', '미수금')
    .order('transaction_date', { ascending: false })
  if (error) throw error
  return data
}

export const getRecentTransactions = async (limit = 5) => {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, type, total_amount, supply_amount, transaction_date, clients(name), memo, payment_status')
    .order('transaction_date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export const getYearlyStats = async (year) => {
  const { data, error } = await supabase
    .from('transactions')
    .select('type, supply_amount, vat, total_amount, transaction_date, clients(name)')
    .gte('transaction_date', `${year}-01-01`)
    .lte('transaction_date', `${year}-12-31`)
  if (error) throw error
  return data
}

// ── 고정비 ────────────────────────────────────────
export const getFixedExpenses = async () => {
  const { data, error } = await supabase
    .from('fixed_expenses')
    .select('*')
    .order('category')
  if (error) throw error
  return data
}

export const createFixedExpense = async (item) => {
  const { data, error } = await supabase
    .from('fixed_expenses').insert(item).select().single()
  if (error) throw error
  return data
}

export const updateFixedExpense = async (id, item) => {
  const { data, error } = await supabase
    .from('fixed_expenses').update(item).eq('id', id).select().single()
  if (error) throw error
  return data
}

export const deleteFixedExpense = async (id) => {
  const { error } = await supabase.from('fixed_expenses').delete().eq('id', id)
  if (error) throw error
}

export const getMonthlyTrend = async (year) => {
  const { data, error } = await supabase
    .from('transactions')
    .select('type, total_amount, transaction_date')
    .gte('transaction_date', `${year}-01-01`)
    .lte('transaction_date', `${year}-12-31`)

  if (error) throw error
  return data
}

export const getClientSales = async (year, month) => {
  let from = `${year}-01-01`
  let to = `${year}-12-31`
  if (month) {
    from = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    to = `${year}-${String(month).padStart(2, '0')}-${lastDay}`
  }

  const { data, error } = await supabase
    .from('transactions')
    .select('type, total_amount, supply_amount, clients(name)')
    .eq('type', '매출')
    .gte('transaction_date', from)
    .lte('transaction_date', to)

  if (error) throw error
  return data
}
