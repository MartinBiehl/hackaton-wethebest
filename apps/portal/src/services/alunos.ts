import { supabase } from './supabase'
import { competenciaAtual, erroDoSupabase } from '@wethebest/shared'

// ativa = aluno já entra no portal; pendente = conta aguardando aprovação do
// responsável; sem_conta = só existe o pré-cadastro.
export type SituacaoConta = 'ativa' | 'pendente' | 'sem_conta'

export type AlunoPortal = {
  id: string
  nome: string
  email_convite: string | null
  situacao_conta: SituacaoConta
  limite_mensal_centavos: number | null
  saldo_centavos: number
  gasto_mes_centavos: number
}

// Responsável: filhos com vínculo ativo. Aluno: ele mesmo.
// A RLS decide o que cada conta enxerga; aqui só juntamos saldo e gasto do mês.
export async function listarAlunos(): Promise<AlunoPortal[]> {
  const { data: alunos, error } = await supabase
    .from('alunos')
    .select('id, nome, email_convite, user_id, user_id_pendente, limite_mensal_centavos')
    .eq('ativo', true)
    .order('nome')
  if (error) throw erroDoSupabase(error)
  if (alunos.length === 0) return []

  const ids = alunos.map((a) => a.id)
  const [saldos, gastos] = await Promise.all([
    supabase.from('saldos_alunos').select('aluno_id, saldo_centavos').in('aluno_id', ids),
    supabase
      .from('gastos_mensais_alunos')
      .select('aluno_id, total_centavos')
      .in('aluno_id', ids)
      .eq('competencia', competenciaAtual()),
  ])
  if (saldos.error) throw erroDoSupabase(saldos.error)
  if (gastos.error) throw erroDoSupabase(gastos.error)

  return alunos.map((a) => ({
    id: a.id,
    nome: a.nome,
    email_convite: a.email_convite,
    situacao_conta: a.user_id ? 'ativa' : a.user_id_pendente ? 'pendente' : 'sem_conta',
    limite_mensal_centavos: a.limite_mensal_centavos,
    saldo_centavos: saldos.data.find((s) => s.aluno_id === a.id)?.saldo_centavos ?? 0,
    gasto_mes_centavos: gastos.data.find((g) => g.aluno_id === a.id)?.total_centavos ?? 0,
  }))
}

export type ResultadoCadastroAluno = { status: 'criado' | 'aguardando_aprovacao'; aluno_id?: string }

// Responsável pré-cadastra o filho e já fica vinculado. Se o e-mail já pertence
// a um aluno, o vínculo fica pendente até ser aprovado por quem já tem acesso.
export async function cadastrarAluno(nome: string, email?: string): Promise<ResultadoCadastroAluno> {
  const { data, error } = await supabase.rpc('cadastrar_aluno', { p_nome: nome, p_email: email })
  if (error) throw erroDoSupabase(error)
  return data as ResultadoCadastroAluno
}

// Teto de compras por mês; null remove o limite. Só responsável ativo.
export async function definirLimiteMensal(alunoId: string, limiteCentavos: number | null): Promise<void> {
  const { error } = await supabase.rpc('definir_limite_mensal', {
    p_aluno_id: alunoId,
    // A função aceita null (remove o limite), mas o tipo gerado não expressa isso.
    p_limite_centavos: limiteCentavos as number,
  })
  if (error) throw erroDoSupabase(error)
}
