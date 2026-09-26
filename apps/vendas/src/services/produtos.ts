import { supabase } from './supabase'
import { erroDoSupabase } from '../utils/erros'

export type Produto = {
  id: string
  nome: string
  descricao: string | null
  preco_centavos: number
  ativo: boolean
  estoque: number
}

export type DadosProduto = {
  nome: string
  descricao?: string | null
  preco_centavos: number
  ativo?: boolean
}

// Catálogo com a quantidade em estoque. A equipe vê também os inativos.
export async function listarProdutos(incluirInativos = false): Promise<Produto[]> {
  let consulta = supabase
    .from('produtos')
    .select('id, nome, descricao, preco_centavos, ativo, estoque(quantidade)')
    .order('nome')
  if (!incluirInativos) consulta = consulta.eq('ativo', true)

  const { data, error } = await consulta
  if (error) throw erroDoSupabase(error)
  return data.map(({ estoque, ...produto }) => ({ ...produto, estoque: estoque?.quantidade ?? 0 }))
}

// O estoque do produto novo nasce zerado (gatilho no banco).
export async function criarProduto(dados: DadosProduto): Promise<string> {
  const { data, error } = await supabase.from('produtos').insert(dados).select('id').single()
  if (error) throw erroDoSupabase(error)
  return data.id
}

// Produtos não são apagados: para tirar de venda, use { ativo: false }.
export async function atualizarProduto(id: string, dados: Partial<DadosProduto>): Promise<void> {
  const { error } = await supabase.from('produtos').update(dados).eq('id', id)
  if (error) throw erroDoSupabase(error)
}

// Define a quantidade contada. Com uma única conta de caixa não há disputa
// com vendas simultâneas; se isso mudar, trocar por ajuste relativo no banco.
export async function definirEstoque(produtoId: string, quantidade: number): Promise<void> {
  const { error } = await supabase.from('estoque').update({ quantidade }).eq('produto_id', produtoId)
  if (error) throw erroDoSupabase(error)
}
