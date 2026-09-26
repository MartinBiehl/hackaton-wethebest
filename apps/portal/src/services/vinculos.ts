import { supabase } from './supabase'
import { erroDoSupabase } from '@wethebest/shared'
import type { Database } from '@wethebest/shared'

export type Vinculo = {
  aluno_id: string
  responsavel_id: string
  status: Database['public']['Enums']['status_vinculo']
  // Nulo quando o vínculo ainda está pendente: a RLS só mostra o aluno após a aprovação.
  aluno: string | null
}

// Responsável: os próprios vínculos. Aluno: quem o acompanha.
export async function listarVinculos(): Promise<Vinculo[]> {
  const { data, error } = await supabase
    .from('responsavel_aluno')
    .select('aluno_id, responsavel_id, status, alunos(nome)')
    .order('criado_em')
  if (error) throw erroDoSupabase(error)
  return data.map(({ alunos, ...vinculo }) => ({ ...vinculo, aluno: alunos?.nome ?? null }))
}

export type ResultadoVinculoConta = {
  status: 'vinculado' | 'aguardando_aprovacao' | 'ja_vinculado' | 'conta_independente'
  aluno_id?: string
}

// Aluno liga a própria conta ao pré-cadastro feito pelo responsável, informando o e-mail dele.
export async function vincularContaAluno(emailResponsavel: string): Promise<ResultadoVinculoConta> {
  const { data, error } = await supabase.rpc('vincular_conta_aluno', {
    p_email_responsavel: emailResponsavel.trim(),
  })
  if (error) throw erroDoSupabase(error)
  return data as ResultadoVinculoConta
}

// Responsável confirma a conta do aluno que reivindicou o pré-cadastro.
export async function aprovarContaAluno(alunoId: string): Promise<void> {
  const { error } = await supabase.rpc('aprovar_conta_aluno', { p_aluno_id: alunoId })
  if (error) throw erroDoSupabase(error)
}

// Aluno titular ou responsável ativo aprova outro responsável.
export async function aprovarVinculo(alunoId: string, responsavelId: string): Promise<void> {
  const { error } = await supabase.rpc('aprovar_vinculo_responsavel', {
    p_aluno_id: alunoId,
    p_responsavel_id: responsavelId,
  })
  if (error) throw erroDoSupabase(error)
}

export async function revogarVinculo(alunoId: string, responsavelId: string): Promise<void> {
  const { error } = await supabase.rpc('revogar_vinculo_responsavel', {
    p_aluno_id: alunoId,
    p_responsavel_id: responsavelId,
  })
  if (error) throw erroDoSupabase(error)
}
