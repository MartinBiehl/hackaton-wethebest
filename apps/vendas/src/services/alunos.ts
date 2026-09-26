import { supabase } from './supabase'
import { erroDoSupabase } from '../utils/erros'

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
