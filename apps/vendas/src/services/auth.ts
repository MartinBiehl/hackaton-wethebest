import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { ErroNegocio, erroDoSupabase } from '@wethebest/shared'
import type { Database } from '@wethebest/shared'

export type Perfil = Pick<Database['public']['Tables']['perfis']['Row'], 'id' | 'nome' | 'email' | 'papel'>

export async function entrar(email: string, senha: string): Promise<Perfil> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
  if (error?.code === 'invalid_credentials') {
    throw new ErroNegocio('login_invalido', 'E-mail ou senha incorretos.')
  }
  if (error?.code === 'email_not_confirmed') {
    throw new ErroNegocio('email_nao_confirmado', 'O e-mail desta conta ainda não foi confirmado.')
  }
  if (error) throw new ErroNegocio(error.code ?? null, `Não foi possível entrar: ${error.message}`)

  const perfil = await perfilAtual()
  // Só experiência de uso: quem de fato bloqueia outras contas é a RLS.
  if (perfil?.papel !== 'equipe') {
    await sair()
    throw new ErroNegocio('papel_insuficiente', 'Esta conta não tem acesso ao sistema de vendas.')
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
