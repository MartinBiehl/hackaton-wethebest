import { supabase } from './supabase'
import { erroDoSupabase } from '../utils/erros'
import type { Database } from '../types/database'

export type StatusPedido = Database['public']['Enums']['status_pedido']

export type PedidoRetirada = {
  id: string
  aluno: string | null
  intervalo: string | null
  data_retirada: string
  status: StatusPedido
  forma_pagamento: Database['public']['Enums']['forma_pagamento_pedido']
  total_centavos: number
  observacao: string | null
  motivo: string | null
  itens: { nome_produto: string; quantidade: number }[]
}

// Pedidos de um dia (a fila de retirada), opcionalmente de um intervalo só.
// Antes de listar, marca como expirados os Pix que passaram do prazo.
export async function listarPedidos(
  dataRetirada: string,
  opcoes: { intervaloId?: string; status?: StatusPedido[] } = {},
): Promise<PedidoRetirada[]> {
  await supabase.rpc('expirar_pendentes')

  let consulta = supabase
    .from('pedidos')
    .select(
      'id, data_retirada, status, forma_pagamento, total_centavos, observacao, motivo, alunos(nome), intervalos_retirada(nome), pedido_itens(nome_produto, quantidade)',
    )
    .eq('data_retirada', dataRetirada)
    .order('criado_em')
  if (opcoes.intervaloId) consulta = consulta.eq('intervalo_id', opcoes.intervaloId)
  if (opcoes.status?.length) consulta = consulta.in('status', opcoes.status)

  const { data, error } = await consulta
  if (error) throw erroDoSupabase(error)

  return data.map(({ alunos, intervalos_retirada, pedido_itens, ...pedido }) => ({
    ...pedido,
    aluno: alunos?.nome ?? null,
    intervalo: intervalos_retirada?.nome ?? null,
    itens: pedido_itens,
  }))
}

// entregue = true: aluno retirou; false: não retirou (o valor não é devolvido).
export async function finalizarPedido(pedidoId: string, entregue: boolean): Promise<void> {
  const { error } = await supabase.rpc('finalizar_pedido', { p_pedido_id: pedidoId, p_entregue: entregue })
  if (error) throw erroDoSupabase(error)
}
