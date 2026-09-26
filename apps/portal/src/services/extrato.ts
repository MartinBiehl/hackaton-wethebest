import { supabase } from './supabase'
import { erroDoSupabase } from '@wethebest/shared'
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
