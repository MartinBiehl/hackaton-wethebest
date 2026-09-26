import { supabase } from './supabase'
import { competenciaAtual, erroDoSupabase } from '@wethebest/shared'

export type AlunoResumo = { id: string; nome: string }

// Escapa os curingas do LIKE para que o texto digitado seja buscado literalmente.
function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (c) => '\\' + c)
}

// Busca por nome e sobrenome: cada palavra digitada precisa aparecer no nome,
// em qualquer ordem ("silva ana" encontra "Ana Paula Silva").
export async function buscarAlunos(termo: string, limite = 20): Promise<AlunoResumo[]> {
  const palavras = termo.trim().split(/\s+/).filter(Boolean)
  if (palavras.length === 0) return []

  let consulta = supabase.from('alunos').select('id, nome').eq('ativo', true)
  for (const palavra of palavras) {
    consulta = consulta.ilike('nome', `%${escaparLike(palavra)}%`)
  }

  const { data, error } = await consulta.order('nome').limit(limite)
  if (error) throw erroDoSupabase(error)
  return data
}

// Cadastro pela equipe: cria o aluno sem vínculo com responsável.
export async function cadastrarAluno(nome: string, email?: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('cadastrar_aluno', { p_nome: nome, p_email: email })
  if (error) throw erroDoSupabase(error)
  const resultado = data as { status: string; aluno_id?: string }
  return resultado.aluno_id ?? null
}

export type SituacaoFinanceira = {
  saldo_centavos: number
  gasto_mes_centavos: number
  limite_mensal_centavos: number | null
}

// Saldo negativo é dívida (fiado). O gasto do mês conta para o limite mensal.
export async function situacaoFinanceira(alunoId: string): Promise<SituacaoFinanceira> {
  const [aluno, saldo, gasto] = await Promise.all([
    supabase.from('alunos').select('limite_mensal_centavos').eq('id', alunoId).single(),
    supabase.from('saldos_alunos').select('saldo_centavos').eq('aluno_id', alunoId).maybeSingle(),
    supabase
      .from('gastos_mensais_alunos')
      .select('total_centavos')
      .eq('aluno_id', alunoId)
      .eq('competencia', competenciaAtual())
      .maybeSingle(),
  ])
  if (aluno.error) throw erroDoSupabase(aluno.error)
  if (saldo.error) throw erroDoSupabase(saldo.error)
  if (gasto.error) throw erroDoSupabase(gasto.error)

  return {
    saldo_centavos: saldo.data?.saldo_centavos ?? 0,
    gasto_mes_centavos: gasto.data?.total_centavos ?? 0,
    limite_mensal_centavos: aluno.data.limite_mensal_centavos,
  }
}

export type AlunoComSaldo = AlunoResumo & {
  email_convite: string | null
  tem_conta: boolean
  saldo_centavos: number
}

// Lista para o cadastro: sem termo, traz os primeiros alunos em ordem alfabética.
export async function listarAlunosComSaldo(termo: string, limite = 100): Promise<AlunoComSaldo[]> {
  let consulta = supabase.from('alunos').select('id, nome, email_convite, user_id').eq('ativo', true)
  for (const palavra of termo.trim().split(/\s+/).filter(Boolean)) {
    consulta = consulta.ilike('nome', `%${escaparLike(palavra)}%`)
  }
  const { data: alunos, error } = await consulta.order('nome').limit(limite)
  if (error) throw erroDoSupabase(error)
  if (alunos.length === 0) return []

  const { data: saldos, error: erroSaldos } = await supabase
    .from('saldos_alunos')
    .select('aluno_id, saldo_centavos')
    .in('aluno_id', alunos.map((aluno) => aluno.id))
  if (erroSaldos) throw erroDoSupabase(erroSaldos)
  const saldoPorAluno = new Map(saldos.map((s) => [s.aluno_id, s.saldo_centavos ?? 0]))

  return alunos.map(({ user_id, ...aluno }) => ({
    ...aluno,
    tem_conta: user_id !== null,
    saldo_centavos: saldoPorAluno.get(aluno.id) ?? 0,
  }))
}

// Soma do que os alunos devem hoje (saldos negativos), em centavos positivos.
export async function fiadoEmAberto(): Promise<number> {
  const { data, error } = await supabase.from('saldos_alunos').select('saldo_centavos').lt('saldo_centavos', 0)
  if (error) throw erroDoSupabase(error)
  return -data.reduce((soma, linha) => soma + (linha.saldo_centavos ?? 0), 0)
}

// Quitação de dívida paga no balcão (dinheiro ou Pix direto para a Carla).
export async function registrarPagamento(alunoId: string, valorCentavos: number, descricao?: string): Promise<void> {
  const { error } = await supabase.rpc('registrar_pagamento', {
    p_aluno_id: alunoId,
    p_valor_centavos: valorCentavos,
    p_descricao: descricao,
  })
  if (error) throw erroDoSupabase(error)
}
