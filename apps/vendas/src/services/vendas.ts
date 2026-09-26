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

export type OrigemVenda = 'balcao' | 'pedido'

export type VendaListada = {
  id: string
  criado_em: string
  aluno_id: string | null
  aluno: string | null
  origem: OrigemVenda
  status: 'confirmada' | 'cancelada'
  total_centavos: number
  quantidade_itens: number
  itens: ItemVendido[]
}

// produto_id fica nulo só se o produto sumir do catálogo; o nome é o do momento da venda.
export type ItemVendido = {
  produto_id: string | null
  nome_produto: string
  quantidade: number
  subtotal_centavos: number
}

export type FiltroVendas = {
  inicio: string
  fim: string
  alunoId?: string
  origem?: OrigemVenda
  // 'avulsa' = cliente não registrado (pago na hora); 'conta' = debitada do saldo do aluno.
  cliente?: 'avulsa' | 'conta'
}

// Vendas de um período (limites em ISO: início incluso, fim excluído), mais recentes primeiro.
export async function listarVendas(filtro: FiltroVendas): Promise<VendaListada[]> {
  let consulta = supabase
    .from('vendas')
    .select('id, criado_em, aluno_id, origem, status, total_centavos, alunos(nome), venda_itens(produto_id, nome_produto, quantidade, subtotal_centavos)')
    .gte('criado_em', filtro.inicio)
    .lt('criado_em', filtro.fim)
    .order('criado_em', { ascending: false })
  if (filtro.alunoId) consulta = consulta.eq('aluno_id', filtro.alunoId)
  if (filtro.origem) consulta = consulta.eq('origem', filtro.origem)
  if (filtro.cliente === 'avulsa') consulta = consulta.is('aluno_id', null)
  if (filtro.cliente === 'conta') consulta = consulta.not('aluno_id', 'is', null)

  const { data, error } = await consulta
  if (error) throw erroDoSupabase(error)

  return data.map(({ alunos, venda_itens, origem, ...venda }) => ({
    ...venda,
    origem: origem as OrigemVenda,
    aluno: alunos?.nome ?? null,
    quantidade_itens: venda_itens.reduce((soma, item) => soma + item.quantidade, 0),
    itens: venda_itens,
  }))
}

export type ResumoPeriodo = {
  total_centavos: number
  quantidade_vendas: number
  avulsas_centavos: number
  conta_centavos: number
  pedidos_centavos: number
  canceladas: number
  creditos_pix_centavos: number
  pagamentos_balcao_centavos: number
}

// Resumo do fechamento: só vendas confirmadas entram nos totais.
// "Avulsas" foram pagas na hora; "conta" saiu do saldo do aluno.
export async function resumoDoPeriodo(inicio: string, fim: string): Promise<ResumoPeriodo> {
  const [vendas, movimentos] = await Promise.all([
    listarVendas({ inicio, fim }),
    supabase
      .from('movimentos_financeiros')
      .select('tipo, valor_centavos, pagamento_id')
      .in('tipo', ['credito', 'pagamento'])
      .gte('criado_em', inicio)
      .lt('criado_em', fim),
  ])
  if (movimentos.error) throw erroDoSupabase(movimentos.error)

  const resumo: ResumoPeriodo = {
    total_centavos: 0,
    quantidade_vendas: 0,
    avulsas_centavos: 0,
    conta_centavos: 0,
    pedidos_centavos: 0,
    canceladas: 0,
    creditos_pix_centavos: 0,
    pagamentos_balcao_centavos: 0,
  }
  for (const venda of vendas) {
    if (venda.status === 'cancelada') {
      resumo.canceladas++
      continue
    }
    resumo.total_centavos += venda.total_centavos
    resumo.quantidade_vendas++
    if (venda.aluno_id === null) resumo.avulsas_centavos += venda.total_centavos
    else resumo.conta_centavos += venda.total_centavos
    if (venda.origem === 'pedido') resumo.pedidos_centavos += venda.total_centavos
  }
  for (const movimento of movimentos.data) {
    if (movimento.tipo === 'credito' && movimento.pagamento_id) resumo.creditos_pix_centavos += movimento.valor_centavos
    if (movimento.tipo === 'pagamento') resumo.pagamentos_balcao_centavos += movimento.valor_centavos
  }
  return resumo
}
