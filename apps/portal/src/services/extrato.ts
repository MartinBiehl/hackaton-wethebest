import { supabase } from './supabase'
import { erroDoSupabase } from '@wethebest/shared'
import { limitesDoMes } from '../utils/datas'
import type { Database } from '@wethebest/shared'

export type Movimento = {
  id: string
  tipo: Database['public']['Enums']['tipo_movimento']
  // Positivo entra no saldo (crédito, estorno); negativo sai (compra).
  valor_centavos: number
  descricao: string | null
  criado_em: string
}

export type Compra = {
  id: string
  criado_em: string
  total_centavos: number
  status: Database['public']['Enums']['status_venda']
  origem: string
  itens: { nome_produto: string; quantidade: number; subtotal_centavos: number }[]
}

export async function listarMovimentos(alunoId: string, limite = 50): Promise<Movimento[]> {
  const { data, error } = await supabase
    .from('movimentos_financeiros')
    .select('id, tipo, valor_centavos, descricao, criado_em')
    .eq('aluno_id', alunoId)
    .order('criado_em', { ascending: false })
    .limit(limite)
  if (error) throw erroDoSupabase(error)
  return data
}

export async function listarCompras(alunoId: string, limite = 30): Promise<Compra[]> {
  const { data, error } = await supabase
    .from('vendas')
    .select('id, criado_em, total_centavos, status, origem, venda_itens(nome_produto, quantidade, subtotal_centavos)')
    .eq('aluno_id', alunoId)
    .order('criado_em', { ascending: false })
    .limit(limite)
  if (error) throw erroDoSupabase(error)
  return data.map(({ venda_itens, ...compra }) => ({ ...compra, itens: venda_itens }))
}

export type ItemMovimento = {
  nome_produto: string
  quantidade: number
  preco_unitario_centavos: number
  subtotal_centavos: number
}

// Movimento com os itens da venda (compra e estorno apontam para uma venda).
export type MovimentoDetalhado = Movimento & { aluno_id: string; itens: ItemMovimento[] }

export type ExtratoDoMes = {
  movimentos: MovimentoDetalhado[]
  totalMovimentos: number
  gastoCentavos: number
}

export const MOVIMENTOS_POR_PAGINA = 20

const SELECAO_DETALHADA =
  'id, aluno_id, tipo, valor_centavos, descricao, criado_em, vendas(venda_itens(nome_produto, quantidade, preco_unitario_centavos, subtotal_centavos))'

type LinhaDetalhada = Movimento & { aluno_id: string; vendas: { venda_itens: ItemMovimento[] } | null }

function detalhar({ vendas, ...movimento }: LinhaDetalhada): MovimentoDetalhado {
  return { ...movimento, itens: vendas?.venda_itens ?? [] }
}

// Extrato de um mês ("YYYY-MM"), paginado, com o gasto do mês pela mesma
// view que o limite mensal usa.
export async function listarExtratoDoMes(alunoId: string, mes: string, pagina: number): Promise<ExtratoDoMes> {
  const periodo = limitesDoMes(mes)
  const de = pagina * MOVIMENTOS_POR_PAGINA
  const [movimentos, gasto] = await Promise.all([
    supabase
      .from('movimentos_financeiros')
      .select(SELECAO_DETALHADA, { count: 'exact' })
      .eq('aluno_id', alunoId)
      .gte('criado_em', periodo.inicio)
      .lt('criado_em', periodo.fim)
      .order('criado_em', { ascending: false })
      .order('id', { ascending: false })
      .range(de, de + MOVIMENTOS_POR_PAGINA - 1),
    supabase
      .from('gastos_mensais_alunos')
      .select('total_centavos')
      .eq('aluno_id', alunoId)
      .eq('competencia', `${mes}-01`)
      .maybeSingle(),
  ])
  if (movimentos.error) throw erroDoSupabase(movimentos.error)
  if (gasto.error) throw erroDoSupabase(gasto.error)

  return {
    movimentos: movimentos.data.map(detalhar),
    totalMovimentos: movimentos.count ?? 0,
    gastoCentavos: gasto.data?.total_centavos ?? 0,
  }
}

// Últimas compras de todos os alunos que a conta enxerga (a RLS filtra).
export async function listarUltimasCompras(limite = 5): Promise<MovimentoDetalhado[]> {
  const { data, error } = await supabase
    .from('movimentos_financeiros')
    .select(SELECAO_DETALHADA)
    .eq('tipo', 'compra')
    .order('criado_em', { ascending: false })
    .order('id', { ascending: false })
    .limit(limite)
  if (error) throw erroDoSupabase(error)
  return data.map(detalhar)
}
