import { supabase } from './supabase'
import { erroDoSupabase, hojeEmSaoPaulo, somarDias } from '@wethebest/shared'
import type { Database } from '@wethebest/shared'

export type FormaPagamento = Database['public']['Enums']['forma_pagamento_pedido']
export type StatusPedido = Database['public']['Enums']['status_pedido']
export type ItemPedido = { produto_id: string; quantidade: number }

export type NovoPedido = {
  intervaloId: string
  dataRetirada: string
  itens: ItemPedido[]
  forma: FormaPagamento
  observacao?: string
}

// Com saldo, o pedido já sai pago. Com Pix, vem a cobrança pendente, que
// expira em 30 minutos ou no fechamento do intervalo.
export type ResultadoPedido =
  | { status: 'pago'; pedido_id: string; total_centavos: number; saldo_centavos: number }
  | { status: 'aguardando_pagamento'; pedido_id: string; pagamento_id: string; total_centavos: number; expira_em: string }

export type Pedido = {
  id: string
  data_retirada: string
  status: StatusPedido
  forma_pagamento: FormaPagamento
  total_centavos: number
  motivo: string | null
  criado_em: string
  intervalo: string | null
  itens: { nome_produto: string; quantidade: number; subtotal_centavos: number }[]
}

// Pedidos valem só para hoje ou amanhã (no fuso da cantina).
export function datasDisponiveis(): string[] {
  const hoje = hojeEmSaoPaulo()
  return [hoje, somarDias(hoje, 1)]
}

// Só o aluno faz pedidos; o banco identifica o aluno pela conta logada.
export async function criarPedido(pedido: NovoPedido): Promise<ResultadoPedido> {
  const { data, error } = await supabase.rpc('criar_pedido', {
    p_intervalo_id: pedido.intervaloId,
    p_data_retirada: pedido.dataRetirada,
    p_itens: pedido.itens,
    p_forma: pedido.forma,
    p_observacao: pedido.observacao,
  })
  if (error) throw erroDoSupabase(error)
  return data as ResultadoPedido
}

// Aluno: os próprios pedidos. Responsável: os dos filhos vinculados.
export async function listarPedidos(limite = 30): Promise<Pedido[]> {
  await supabase.rpc('expirar_pendentes')

  const { data, error } = await supabase
    .from('pedidos')
    .select(
      'id, data_retirada, status, forma_pagamento, total_centavos, motivo, criado_em, intervalos_retirada(nome), pedido_itens(nome_produto, quantidade, subtotal_centavos)',
    )
    .order('criado_em', { ascending: false })
    .limit(limite)
  if (error) throw erroDoSupabase(error)

  return data.map(({ intervalos_retirada, pedido_itens, ...pedido }) => ({
    ...pedido,
    intervalo: intervalos_retirada?.nome ?? null,
    itens: pedido_itens,
  }))
}
