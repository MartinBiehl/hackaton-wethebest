import { useEffect, useState, type ReactNode } from 'react'
import { ContextoCarrinho, MAXIMO_POR_ITEM, type ItemCarrinho } from '../hooks/useCarrinho'

function itemValido(item: ItemCarrinho): boolean {
  return (
    typeof item.produto_id === 'string' &&
    typeof item.nome === 'string' &&
    Number.isSafeInteger(item.preco_centavos) &&
    item.preco_centavos > 0 &&
    Number.isInteger(item.quantidade) &&
    item.quantidade > 0 &&
    item.quantidade <= MAXIMO_POR_ITEM
  )
}

function lerSalvo(chave: string): ItemCarrinho[] {
  try {
    const salvo: unknown = JSON.parse(sessionStorage.getItem(chave) || '[]')
    if (Array.isArray(salvo)) return salvo.filter(itemValido)
  } catch {
    // O carrinho não é fonte financeira: dado inválido é descartado.
  }
  return []
}

// Carrinho do aluno, guardado por conta na aba atual.
export function ProvedorCarrinho({ usuarioId, children }: { usuarioId: string; children: ReactNode }) {
  const chave = `icarla-carrinho:${usuarioId}`
  const [itens, setItens] = useState<ItemCarrinho[]>(() => lerSalvo(chave))

  useEffect(() => {
    try {
      sessionStorage.setItem(chave, JSON.stringify(itens))
    } catch {
      // Sem armazenamento a navegação continua funcionando.
    }
  }, [itens, chave])

  return (
    <ContextoCarrinho.Provider value={{ itens, alterar: setItens, limpar: () => setItens([]) }}>
      {children}
    </ContextoCarrinho.Provider>
  )
}
