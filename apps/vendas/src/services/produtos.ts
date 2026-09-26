import { supabase } from './supabase'
import { ErroNegocio, erroDoSupabase } from '../utils/erros'

const BUCKET_FOTOS = 'produtos'
const TIPOS_FOTO: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const TAMANHO_MAXIMO_FOTO = 5 * 1024 * 1024

export type Produto = {
  id: string
  nome: string
  descricao: string | null
  preco_centavos: number
  ativo: boolean
  foto_path: string | null
  estoque: number
}

export type DadosProduto = {
  nome: string
  descricao?: string | null
  preco_centavos: number
  ativo?: boolean
}

// Catálogo com a quantidade em estoque. A equipe vê também os inativos.
export async function listarProdutos(incluirInativos = false): Promise<Produto[]> {
  let consulta = supabase
    .from('produtos')
    .select('id, nome, descricao, preco_centavos, ativo, foto_path, estoque(quantidade)')
    .order('nome')
  if (!incluirInativos) consulta = consulta.eq('ativo', true)

  const { data, error } = await consulta
  if (error) throw erroDoSupabase(error)
  return data.map(({ estoque, ...produto }) => ({ ...produto, estoque: estoque?.quantidade ?? 0 }))
}

// O estoque do produto novo nasce zerado (gatilho no banco).
export async function criarProduto(dados: DadosProduto): Promise<string> {
  const { data, error } = await supabase.from('produtos').insert(dados).select('id').single()
  if (error) throw erroDoSupabase(error)
  return data.id
}

// Produtos não são apagados: para tirar de venda, use { ativo: false }.
export async function atualizarProduto(id: string, dados: Partial<DadosProduto>): Promise<void> {
  const { error } = await supabase.from('produtos').update(dados).eq('id', id)
  if (error) throw erroDoSupabase(error)
}

// Define a quantidade contada. Com uma única conta de caixa não há disputa
// com vendas simultâneas; se isso mudar, trocar por ajuste relativo no banco.
export async function definirEstoque(produtoId: string, quantidade: number): Promise<void> {
  const { error } = await supabase.from('estoque').update({ quantidade }).eq('produto_id', produtoId)
  if (error) throw erroDoSupabase(error)
}

// Envia a foto (JPEG, PNG ou WebP, até 5 MB) e troca a do produto.
// Cada envio gera um arquivo novo, então a URL muda e o navegador não mostra a foto antiga em cache.
export async function enviarFoto(produtoId: string, arquivo: File): Promise<string> {
  const extensao = TIPOS_FOTO[arquivo.type]
  if (!extensao) throw new ErroNegocio('foto_invalida', 'Use uma foto JPEG, PNG ou WebP.')
  if (arquivo.size > TAMANHO_MAXIMO_FOTO) throw new ErroNegocio('foto_invalida', 'A foto deve ter no máximo 5 MB.')

  const { data: atual } = await supabase.from('produtos').select('foto_path').eq('id', produtoId).single()

  const caminho = `${produtoId}/${crypto.randomUUID()}.${extensao}`
  const { error: erroEnvio } = await supabase.storage
    .from(BUCKET_FOTOS)
    .upload(caminho, arquivo, { contentType: arquivo.type })
  if (erroEnvio) throw new ErroNegocio('foto_invalida', 'Não foi possível enviar a foto.')

  const { error } = await supabase.from('produtos').update({ foto_path: caminho }).eq('id', produtoId)
  if (error) {
    await supabase.storage.from(BUCKET_FOTOS).remove([caminho])
    throw erroDoSupabase(error)
  }

  // A foto anterior deixa de ser usada; se a remoção falhar, só sobra um arquivo órfão.
  if (atual?.foto_path) await supabase.storage.from(BUCKET_FOTOS).remove([atual.foto_path])
  return caminho
}

export async function removerFoto(produtoId: string, fotoPath: string): Promise<void> {
  const { error } = await supabase.from('produtos').update({ foto_path: null }).eq('id', produtoId)
  if (error) throw erroDoSupabase(error)
  await supabase.storage.from(BUCKET_FOTOS).remove([fotoPath])
}

export function urlFoto(fotoPath: string | null): string | null {
  if (!fotoPath) return null
  return supabase.storage.from(BUCKET_FOTOS).getPublicUrl(fotoPath).data.publicUrl
}
