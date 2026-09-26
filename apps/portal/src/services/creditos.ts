import { supabase } from './supabase'
import { erroDoSupabase } from '@wethebest/shared'
import type { Database } from '@wethebest/shared'

export type CobrancaCredito = { pagamento_id: string; valor_centavos: number; expira_em: string }

export type Pagamento = {
  id: string
  tipo: Database['public']['Enums']['tipo_pagamento']
  status: Database['public']['Enums']['status_pagamento']
  valor_centavos: number
  expira_em: string
  pago_em: string | null
  criado_em: string
}

// Gera a cobrança do crédito. O saldo só muda quando o pagamento for
// confirmado (hoje pela Carla; depois, pela API de Pix).
export async function solicitarCredito(alunoId: string, valorCentavos: number): Promise<CobrancaCredito> {
  const { data, error } = await supabase.rpc('solicitar_credito', {
    p_aluno_id: alunoId,
    p_valor_centavos: valorCentavos,
  })
  if (error) throw erroDoSupabase(error)
  return data as CobrancaCredito
}

// Cobranças do aluno (créditos e pedidos), da mais recente para a mais antiga.
export async function listarPagamentos(alunoId: string, limite = 30): Promise<Pagamento[]> {
  await supabase.rpc('expirar_pendentes')

  const { data, error } = await supabase
    .from('pagamentos')
    .select('id, tipo, status, valor_centavos, expira_em, pago_em, criado_em')
    .eq('aluno_id', alunoId)
    .order('criado_em', { ascending: false })
    .limit(limite)
  if (error) throw erroDoSupabase(error)
  return data
}
