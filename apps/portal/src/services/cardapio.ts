import { supabase } from './supabase'
import { erroDoSupabase } from '@wethebest/shared'

export type ItemCardapio = {
  id: string
  nome: string
  descricao: string | null
  preco_centavos: number
  foto_url: string | null
  // Unidades agora. Não há reserva: o pedido só garante o item quando é pago.
  disponivel: number
}

export type IntervaloRetirada = { id: string; nome: string; inicio: string; fim: string }

// Produtos ativos; a RLS já esconde os inativos de pais e alunos.
export async function listarCardapio(): Promise<ItemCardapio[]> {
  const { data, error } = await supabase
    .from('produtos')
    .select('id, nome, descricao, preco_centavos, foto_path, estoque(quantidade)')
    .eq('ativo', true)
    .order('nome')
  if (error) throw erroDoSupabase(error)

  return data.map(({ foto_path, estoque, ...produto }) => ({
    ...produto,
    foto_url: foto_path ? supabase.storage.from('produtos').getPublicUrl(foto_path).data.publicUrl : null,
    disponivel: estoque?.quantidade ?? 0,
  }))
}

// Horários de retirada, no fuso America/Sao_Paulo ("HH:MM:SS").
export async function listarIntervalos(): Promise<IntervaloRetirada[]> {
  const { data, error } = await supabase
    .from('intervalos_retirada')
    .select('id, nome, inicio, fim')
    .eq('ativo', true)
    .order('inicio')
  if (error) throw erroDoSupabase(error)
  return data
}
