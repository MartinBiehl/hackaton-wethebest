import { supabase } from './supabase'
import { erroDoSupabase } from '@wethebest/shared'

export type ItemVenda = { produto_id: string; quantidade: number }

// Campos financeiros vêm nulos em venda para cliente não registrado.
export type VendaRegistrada = {
  venda_id: string
  total_centavos: number
  saldo_centavos: number | null
  gasto_mes_centavos: number | null
  limite_mensal_centavos: number | null
}

export type VendaCancelavel = {
  id: string
  criado_em: string
  total_centavos: number
  observacao: string | null
  aluno: string | null
  itens: { nome_produto: string; quantidade: number; subtotal_centavos: number }[]
}

const PRAZO_CANCELAMENTO_MS = 24 * 60 * 60 * 1000

// alunoId null = cliente não registrado: pago na hora, fora do extrato e dos limites.
// O preço não é enviado: a função do banco usa o valor vigente no catálogo.
export async function registrarVenda(
  alunoId: string | null,
  itens: ItemVenda[],
  observacao?: string,
): Promise<VendaRegistrada> {
  const { data, error } = await supabase.rpc('registrar_venda', {
    p_aluno_id: alunoId ?? undefined,
    p_itens: itens,
    p_observacao: observacao,
  })
  if (error) throw erroDoSupabase(error)
  return data as VendaRegistrada
}

// O prazo de 24 horas é validado no banco; aqui só filtramos a lista.
export async function cancelarVenda(vendaId: string, motivo?: string): Promise<void> {
  const { error } = await supabase.rpc('cancelar_venda', { p_venda_id: vendaId, p_motivo: motivo })
  if (error) throw erroDoSupabase(error)
}

// Vendas confirmadas nas últimas 24 horas, que ainda podem ser canceladas.
export async function listarVendasCancelaveis(): Promise<VendaCancelavel[]> {
  const desde = new Date(Date.now() - PRAZO_CANCELAMENTO_MS).toISOString()
  const { data, error } = await supabase
    .from('vendas')
    .select('id, criado_em, total_centavos, observacao, alunos(nome), venda_itens(nome_produto, quantidade, subtotal_centavos)')
    .eq('status', 'confirmada')
    .gte('criado_em', desde)
    .order('criado_em', { ascending: false })
  if (error) throw erroDoSupabase(error)

  return data.map(({ alunos, venda_itens, ...venda }) => ({
    ...venda,
    aluno: alunos?.nome ?? null,
    itens: venda_itens,
  }))
}
