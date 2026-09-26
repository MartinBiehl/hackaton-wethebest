import { supabase } from './supabase'
import { erroDoSupabase } from '@wethebest/shared'
import type { Database } from '@wethebest/shared'

export type PagamentoAberto = {
  id: string
  tipo: Database['public']['Enums']['tipo_pagamento']
  status: Database['public']['Enums']['status_pagamento']
  aluno: string | null
  valor_centavos: number
  expira_em: string
  criado_em: string
  pedido_id: string | null
}

export type ResultadoConfirmacao = {
  pagamento_id: string
  status: 'creditado' | 'pedido_pago' | 'pedido_recusado' | 'pedido_expirado' | 'ja_confirmado'
  pedido_id?: string
  motivo?: string | null
}

// Pix ainda não confirmados. Inclui os expirados: se o dinheiro chegou depois
// do prazo, a Carla ainda confirma e o valor vira crédito do aluno.
export async function listarPagamentosAbertos(): Promise<PagamentoAberto[]> {
  await supabase.rpc('expirar_pendentes')

  const { data, error } = await supabase
    .from('pagamentos')
    .select('id, tipo, status, valor_centavos, expira_em, criado_em, pedido_id, alunos(nome)')
    .in('status', ['pendente', 'expirado'])
    .order('criado_em', { ascending: false })
  if (error) throw erroDoSupabase(error)

  return data.map(({ alunos, ...pagamento }) => ({ ...pagamento, aluno: alunos?.nome ?? null }))
}

// Provisório até a API de Pix: a Carla confirma que o dinheiro entrou.
export async function confirmarPagamento(pagamentoId: string): Promise<ResultadoConfirmacao> {
  const { data, error } = await supabase.rpc('confirmar_pagamento', { p_pagamento_id: pagamentoId })
  if (error) throw erroDoSupabase(error)
  return data as ResultadoConfirmacao
}
