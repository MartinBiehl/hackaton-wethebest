import { supabase } from './supabase'
import { erroDoSupabase } from '@wethebest/shared'

// Horários no formato "HH:MM", no fuso America/Sao_Paulo.
export type Intervalo = { id: string; nome: string; inicio: string; fim: string; ativo: boolean }
export type DadosIntervalo = { nome: string; inicio: string; fim: string; ativo?: boolean }

// A equipe vê também os intervalos desativados.
export async function listarIntervalos(): Promise<Intervalo[]> {
  const { data, error } = await supabase
    .from('intervalos_retirada')
    .select('id, nome, inicio, fim, ativo')
    .order('inicio')
  if (error) throw erroDoSupabase(error)
  return data
}

export async function criarIntervalo(dados: DadosIntervalo): Promise<string> {
  const { data, error } = await supabase.from('intervalos_retirada').insert(dados).select('id').single()
  if (error) throw erroDoSupabase(error)
  return data.id
}

// Para tirar um intervalo de uso, { ativo: false }; pedidos já feitos continuam valendo.
export async function atualizarIntervalo(id: string, dados: Partial<DadosIntervalo>): Promise<void> {
  const { error } = await supabase.from('intervalos_retirada').update(dados).eq('id', id)
  if (error) throw erroDoSupabase(error)
}
