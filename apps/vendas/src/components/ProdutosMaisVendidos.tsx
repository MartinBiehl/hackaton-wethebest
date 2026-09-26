import { useMemo, useState } from 'react'
import { formatarCentavos } from '@wethebest/shared'
import type { VendaListada } from '../services/vendas'

const QUANTOS = 5

type Criterio = 'unidades' | 'faturamento'
type ProdutoVendido = { chave: string; nome: string; unidades: number; faturamento_centavos: number }

function unidades(n: number): string {
  return `${n} ${n === 1 ? 'unidade' : 'unidades'}`
}

// Ranking das vendas já filtradas na tela (só as confirmadas chegam aqui).
export function ProdutosMaisVendidos({ vendas }: { vendas: VendaListada[] }) {
  const [criterio, setCriterio] = useState<Criterio>('unidades')
  const [ativo, setAtivo] = useState<string | null>(null)

  const produtos = useMemo(() => {
    const porProduto = new Map<string, ProdutoVendido>()
    // A lista vem da venda mais recente para a mais antiga: o nome mostrado é o mais atual.
    for (const venda of vendas) {
      for (const item of venda.itens) {
        const chave = item.produto_id ?? item.nome_produto
        const atual = porProduto.get(chave) ?? { chave, nome: item.nome_produto, unidades: 0, faturamento_centavos: 0 }
        atual.unidades += item.quantidade
        atual.faturamento_centavos += item.subtotal_centavos
        porProduto.set(chave, atual)
      }
    }
    return [...porProduto.values()]
  }, [vendas])

  const valor = (p: ProdutoVendido) => (criterio === 'unidades' ? p.unidades : p.faturamento_centavos)
  const ordenados = [...produtos].sort((a, b) => valor(b) - valor(a) || a.nome.localeCompare(b.nome))
  const primeiros = ordenados.slice(0, QUANTOS)
  const outros = ordenados.slice(QUANTOS)
  const total = produtos.reduce((soma, p) => soma + valor(p), 0)
  const maior = primeiros.length ? valor(primeiros[0]) : 0

  const principal = (p: ProdutoVendido) =>
    criterio === 'unidades' ? unidades(p.unidades) : formatarCentavos(p.faturamento_centavos)
  const secundario = (p: ProdutoVendido) =>
    criterio === 'unidades' ? formatarCentavos(p.faturamento_centavos) : unidades(p.unidades)

  return (
    <section className="cartao">
      <div className="ranking-cabecalho">
        <div>
          <h2>Produtos mais vendidos</h2>
          <p className="texto-apoio">Vendas confirmadas com os filtros acima.</p>
        </div>
        <div className="segmentado" role="group" aria-label="Ordenar por">
          <button type="button" aria-pressed={criterio === 'unidades'} onClick={() => setCriterio('unidades')}>
            Unidades
          </button>
          <button type="button" aria-pressed={criterio === 'faturamento'} onClick={() => setCriterio('faturamento')}>
            Faturamento
          </button>
        </div>
      </div>

      {primeiros.length === 0 ? (
        <p className="vazio-bloco">Nenhum produto vendido neste período.</p>
      ) : (
        <ol className="ranking" aria-label={`Produtos mais vendidos por ${criterio}`}>
          {primeiros.map((produto, posicao) => {
            const largura = maior ? (valor(produto) / maior) * 100 : 0
            const participacao = total ? Math.round((valor(produto) / total) * 100) : 0
            return (
              <li
                key={produto.chave}
                className="ranking-item"
                tabIndex={0}
                onPointerEnter={() => setAtivo(produto.chave)}
                onPointerLeave={() => setAtivo(null)}
                onFocus={() => setAtivo(produto.chave)}
                onBlur={() => setAtivo(null)}
              >
                <span className="ranking-posicao">{posicao + 1}º</span>
                <span className="ranking-nome" title={produto.nome}>
                  {produto.nome}
                </span>
                <span className="ranking-grafico" aria-hidden="true">
                  <span className="ranking-barra" style={{ width: `${largura}%` }} />
                  {ativo === produto.chave && (
                    <span className="ranking-dica" style={{ left: `${Math.min(Math.max(largura, 20), 80)}%` }}>
                      <strong>{produto.nome}</strong>
                      {unidades(produto.unidades)} · {formatarCentavos(produto.faturamento_centavos)} · {participacao}% do{' '}
                      {criterio === 'unidades' ? 'total de unidades' : 'faturamento'}
                    </span>
                  )}
                </span>
                <span className="ranking-valor">
                  {principal(produto)}
                  <small>{secundario(produto)}</small>
                </span>
              </li>
            )
          })}
        </ol>
      )}

      {outros.length > 0 && (
        <p className="texto-apoio ranking-outros">
          Outros {outros.length} {outros.length === 1 ? 'produto' : 'produtos'}:{' '}
          {unidades(outros.reduce((soma, p) => soma + p.unidades, 0))} ·{' '}
          {formatarCentavos(outros.reduce((soma, p) => soma + p.faturamento_centavos, 0))}
        </p>
      )}
    </section>
  )
}
