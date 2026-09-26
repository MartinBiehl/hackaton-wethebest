import { formatarCentavos } from '@wethebest/shared'
import { totalDoCarrinho, type ItemCarrinho } from '../hooks/useCarrinho'

// Problemas que o banco recusaria. A conferência aqui só adianta o aviso:
// criar_pedido valida tudo de novo.
export function problemasDoPedido(
  itens: ItemCarrinho[],
  disponivel: Map<string, number>,
  gastoMes: number,
  limite: number | null,
): string[] {
  const problemas: string[] = []
  for (const item of itens) {
    const unidades = disponivel.get(item.produto_id)
    if (unidades === undefined) {
      problemas.push(`${item.nome} saiu do cardápio. Remova-o do pedido.`)
    } else if (item.quantidade > unidades) {
      problemas.push(
        unidades > 0 ? `Só há ${unidades} unidade(s) de ${item.nome} agora.` : `${item.nome} esgotou. Remova-o do pedido.`,
      )
    }
  }
  if (limite !== null && gastoMes + totalDoCarrinho(itens) > limite) {
    problemas.push(
      `O pedido ultrapassa o limite mensal de ${formatarCentavos(limite)} (já foram gastos ${formatarCentavos(gastoMes)} neste mês).`,
    )
  }
  return problemas
}
