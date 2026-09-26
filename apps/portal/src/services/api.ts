import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import type { Item, Movement, PortalService, Profile, Student } from '../types'
import { currentMonth, monthRange, productPresentation } from '../utils/format'
import { orders } from './orders'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
// A autenticação externa deve usar este mesmo cliente/sessão. Sem login nesta entrega.
export const supabase = url && key ? createClient<Database>(url, key) : null
function client() { if (!supabase) throw new Error('O acesso do iCarla ainda não foi configurado.'); return supabase }
export function explain(error: unknown): string {
 const e = error as { message?: string; details?: string }
 const messages: Record<string, string> = {
  'Failed to fetch': 'Não foi possível conectar. Confira sua internet e tente novamente.',
  limite_mensal_excedido: 'O limite mensal definido pelo responsável foi ultrapassado.',
  limite_divida_excedido: 'A compra ultrapassa o teto de fiado de R$ 250,00.',
  papel_insuficiente: 'Sua conta não tem permissão para esta ação.',
  aluno_invalido: 'Aluno indisponível ou vínculo ainda não aprovado.',
  valor_invalido: 'Confira o valor informado.',
 }
 return messages[e.details || ''] || messages[e.message || ''] || e.message || 'Não foi possível concluir. Tente novamente.'
}
const movementSelection = 'id,aluno_id,criado_em,descricao,tipo,valor_centavos,vendas(venda_itens(produto_id,nome_produto,preco_unitario_centavos,quantidade))' as const
type MovementRow = { id: string; aluno_id: string; criado_em: string; descricao: string | null; tipo: string; valor_centavos: number; vendas: { venda_itens: { produto_id: string | null; nome_produto: string; preco_unitario_centavos: number; quantidade: number }[] } | null }
function movement(row: MovementRow): Movement {
 return { id: row.id, alunoId: row.aluno_id, data: row.criado_em, descricao: row.descricao || row.tipo, tipo: row.tipo, valor: row.valor_centavos, itens: row.vendas?.venda_itens.map((i): Item => ({ productId: i.produto_id || '', nome: i.nome_produto, preco: i.preco_unitario_centavos, quantidade: i.quantidade })) || [] }
}
async function students(id?: string): Promise<Student[]> {
 const c = client()
 let query = c.from('alunos').select('id,nome,email_convite,limite_mensal_centavos,user_id_pendente').eq('ativo', true).order('nome')
 if (id) query = query.eq('id', id)
 const { data, error } = await query
 if (error) throw error
 if (!data?.length) return []
 const ids = data.map(s => s.id)
 const [balances, spending] = await Promise.all([
  c.from('saldos_alunos').select('aluno_id,saldo_centavos').in('aluno_id', ids),
  c.from('gastos_mensais_alunos').select('aluno_id,total_centavos').in('aluno_id', ids).eq('competencia', currentMonth() + '-01'),
 ])
 if (balances.error) throw balances.error
 if (spending.error) throw spending.error
 return data.map(s => ({ id: s.id, nome: s.nome, email: s.email_convite || '', saldo: balances.data.find(b => b.aluno_id === s.id)?.saldo_centavos ?? 0, gasto: spending.data.find(g => g.aluno_id === s.id)?.total_centavos ?? 0, limite: s.limite_mensal_centavos, pendente: !!s.user_id_pendente }))
}
export const portalService: PortalService = {
 configured: Boolean(supabase),
 async getProfile() {
  const c = client()
  const { data, error } = await c.auth.getSession()
  if (error) throw error
  if (!data.session) return null
  const result = await c.from('perfis').select('id,nome,email,papel').eq('id', data.session.user.id).single()
  if (result.error) throw result.error
  if (result.data.papel === 'equipe') throw new Error('Este portal é destinado a alunos e responsáveis.')
  return result.data as Profile
 },
 onSessionChange(callback) {
  if (!supabase) return () => {}
  // Não aguardar consultas Supabase dentro do callback de autenticação.
  const { data } = supabase.auth.onAuthStateChange(() => { window.setTimeout(callback, 0) })
  return () => data.subscription.unsubscribe()
 },
 listStudents: () => students(),
 async getStudent(id) { return (await students(id))[0] || null },
 async listProducts() {
  const { data, error } = await client().from('produtos').select('id,nome,descricao,preco_centavos').eq('ativo', true).order('nome')
  if (error) throw error
  return data.map(p => ({ id: p.id, nome: p.nome, descricao: p.descricao || '', preco: p.preco_centavos, ...productPresentation(p.nome), disponibilidade: 'desconhecida' as const }))
 },
 async recentPurchases() {
  const { data, error } = await client().from('movimentos_financeiros').select(movementSelection).eq('tipo', 'compra').order('criado_em', { ascending: false }).order('id', { ascending: false }).limit(5)
  if (error) throw error
  return data.map(movement)
 },
 async statement(id, month, page) {
  const { start, end } = monthRange(month)
  const c = client()
  const [rows, aggregate] = await Promise.all([
   c.from('movimentos_financeiros').select(movementSelection, { count: 'exact' }).eq('aluno_id', id).gte('criado_em', start).lt('criado_em', end).order('criado_em', { ascending: false }).order('id', { ascending: false }).range(page * 20, page * 20 + 19),
   c.from('gastos_mensais_alunos').select('total_centavos').eq('aluno_id', id).eq('competencia', month + '-01').maybeSingle(),
  ])
  if (rows.error) throw rows.error
  if (aggregate.error) throw aggregate.error
  return { entries: rows.data.map(movement), totalExpense: aggregate.data?.total_centavos ?? 0, totalCount: rows.count ?? 0 }
 },
 async setLimit(id, value) {
  // O SQL aceita NULL; os tipos gerados pelo backend não expressam isso.
  const { error } = await client().rpc('definir_limite_mensal', { p_aluno_id: id, p_limite_centavos: value as number })
  if (error) throw error
 },
 async addCredit(id, value) {
  const { error } = await client().rpc('adicionar_credito', { p_aluno_id: id, p_valor_centavos: value, p_descricao: 'Crédito adicionado pelo responsável no iCarla' })
  if (error) throw error
 },
 orders,
}
