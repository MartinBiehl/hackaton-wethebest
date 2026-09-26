import { createContext, useContext } from 'react'

// Preço e nome servem só para a tela: o banco recalcula tudo pelo catálogo.
export type ItemCarrinho = { produto_id: string; nome: string; preco_centavos: number; quantidade: number }

export const MAXIMO_POR_ITEM = 99

export type Carrinho = {
  itens: ItemCarrinho[]
  alterar: (itens: ItemCarrinho[]) => void
  limpar: () => void
}

export const ContextoCarrinho = createContext<Carrinho | null>(null)

export function useCarrinho(): Carrinho {
  const carrinho = useContext(ContextoCarrinho)
  if (!carrinho) throw new Error('Carrinho fora do ProvedorCarrinho.')
  return carrinho
}

export function totalDoCarrinho(itens: ItemCarrinho[]): number {
  return itens.reduce((soma, item) => soma + item.preco_centavos * item.quantidade, 0)
}

export function unidadesDoCarrinho(itens: ItemCarrinho[]): number {
  return itens.reduce((soma, item) => soma + item.quantidade, 0)
}
