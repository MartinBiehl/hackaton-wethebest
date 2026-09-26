import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { ErroNegocio, erroDoSupabase } from '@wethebest/shared'
import type { Database } from '@wethebest/shared'

export type Perfil = Pick<Database['public']['Tables']['perfis']['Row'], 'id' | 'nome' | 'email' | 'papel'>
export type PapelPortal = 'responsavel' | 'aluno'

export type DadosCadastro = { nome: string; email: string; senha: string; papel: PapelPortal }

// O papel vai no metadata; o banco aceita só 'responsavel' ou 'aluno'
// (qualquer outro valor vira 'responsavel'), então ninguém se cadastra como equipe.
export async function cadastrar(dados: DadosCadastro): Promise<{ precisaConfirmarEmail: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email: dados.email.trim(),
    password: dados.senha,
    options: { data: { nome: dados.nome.trim(), papel: dados.papel } },
  })
  if (error?.code === 'user_already_exists') {
    throw new ErroNegocio('conta_existente', 'Já existe uma conta com esse e-mail.')
  }
  if (error?.code === 'weak_password') {
    throw new ErroNegocio('senha_fraca', 'Senha muito fraca. Use pelo menos 6 caracteres.')
  }
  if (error) throw new ErroNegocio(error.code ?? null, `Não foi possível cadastrar: ${error.message}`)

  // Sem sessão = o projeto exige confirmar o e-mail antes do primeiro login.
  return { precisaConfirmarEmail: !data.session }
}

export async function entrar(email: string, senha: string): Promise<Perfil> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
  if (error?.code === 'invalid_credentials') {
    throw new ErroNegocio('login_invalido', 'E-mail ou senha incorretos.')
  }
  if (error?.code === 'email_not_confirmed') {
    throw new ErroNegocio('email_nao_confirmado', 'Confirme seu e-mail pelo link que enviamos antes de entrar.')
  }
  if (error) throw new ErroNegocio(error.code ?? null, `Não foi possível entrar: ${error.message}`)

  const perfil = await perfilAtual()
  // Só experiência de uso: quem de fato limita os dados é a RLS.
  if (!perfil || perfil.papel === 'equipe') {
    await sair()
    throw new ErroNegocio('papel_insuficiente', 'Esta conta é da equipe. Use o app de vendas.')
  }
  return perfil
}

export async function sair(): Promise<void> {
  await supabase.auth.signOut()
}

export async function perfilAtual(): Promise<Perfil | null> {
  const { data: sessao } = await supabase.auth.getSession()
  const userId = sessao.session?.user.id
  if (!userId) return null

  const { data, error } = await supabase
    .from('perfis')
    .select('id, nome, email, papel')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw erroDoSupabase(error)
  return data
}

// Avisa a interface quando a sessão começa, termina ou expira.
export function aoMudarSessao(callback: (sessao: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_evento, sessao) => callback(sessao))
  return () => data.subscription.unsubscribe()
}
