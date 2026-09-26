import { Link } from 'react-router-dom'
import { formatarCentavos } from '@wethebest/shared'
import { listarCardapio } from '../../services/cardapio'
import { useAssincrono } from '../../hooks/useAssincrono'
import { useAluno } from '../../hooks/useAluno'
import { MAXIMO_POR_ITEM, totalDoCarrinho, useCarrinho } from '../../hooks/useCarrinho'
import { problemasDoPedido } from '../../utils/pedido'
import { Icone } from '../../components/Icone'
import { ResumoPedido } from '../../components/ResumoPedido'
import { Aviso, Carregando, Etapas, Falha, Vazio, Voltar } from '../../components/ui'

export function MeuPedido() {
  const { aluno } = useAluno()
  const carrinho = useCarrinho()
  const cardapio = useAssincrono(listarCardapio, [])

  function alterarQuantidade(produtoId: string, quantidade: number) {
    carrinho.alterar(
      quantidade <= 0
        ? carrinho.itens.filter((item) => item.produto_id !== produtoId)
        : carrinho.itens.map((item) =>
            item.produto_id === produtoId ? { ...item, quantidade: Math.min(MAXIMO_POR_ITEM, quantidade) } : item,
          ),
    )
  }

  if (!carrinho.itens.length) {
    return (
      <div className="narrow-page">
        <Voltar para="/aluno">Voltar</Voltar>
        <h1>Meu pedido</h1>
        <Etapas atual={1} />
        <section className="card">
          <Vazio titulo="Seu pedido está vazio" icone="sacola">
            Escolha seus produtos no cardápio.
          </Vazio>
          <Link className="button primary full" to="/aluno">
            Ver cardápio
          </Link>
        </section>
      </div>
    )
  }

  if (!cardapio.dados) {
    return cardapio.erro ? <Falha mensagem={cardapio.erro} tentarDeNovo={cardapio.recarregar} /> : <Carregando />
  }

  // Preço exibido sempre o do catálogo atual; o banco usa o mesmo valor.
  const produtos = new Map(cardapio.dados.map((produto) => [produto.id, produto]))
  const itens = carrinho.itens.map((item) => ({
    ...item,
    preco_centavos: produtos.get(item.produto_id)?.preco_centavos ?? item.preco_centavos,
  }))
  const total = totalDoCarrinho(itens)
  const disponivel = new Map(cardapio.dados.map((produto) => [produto.id, produto.disponivel]))
  const problemas = problemasDoPedido(itens, disponivel, aluno.gasto_mes_centavos, aluno.limite_mensal_centavos)

  return (
    <div className="narrow-page">
      <Voltar para="/aluno">Voltar</Voltar>
      <h1>Meu pedido</h1>
      <Etapas atual={1} />

      <section className="card cart-items">
        <div className="cart-table-head" aria-hidden="true">
          <span>Produto</span>
          <span>Qtd</span>
          <span>Un.</span>
          <span>Total</span>
          <span />
        </div>
        {itens.map((item) => (
          <div className="cart-item" key={item.produto_id}>
            <h3>{item.nome}</h3>
            <div className="quantity">
              <button
                type="button"
                onClick={() => alterarQuantidade(item.produto_id, item.quantidade - 1)}
                aria-label={`Diminuir ${item.nome}`}
              >
                <Icone nome="menos" tamanho={14} />
              </button>
              <span>{item.quantidade}</span>
              <button
                type="button"
                onClick={() => alterarQuantidade(item.produto_id, item.quantidade + 1)}
                disabled={item.quantidade >= Math.min(MAXIMO_POR_ITEM, disponivel.get(item.produto_id) ?? 0)}
                aria-label={`Aumentar ${item.nome}`}
              >
                <Icone nome="mais" tamanho={14} />
              </button>
            </div>
            <span className="unit-price">{formatarCentavos(item.preco_centavos)}</span>
            <strong>{formatarCentavos(item.preco_centavos * item.quantidade)}</strong>
            <button
              type="button"
              className="icon-button danger"
              aria-label={`Remover ${item.nome}`}
              onClick={() => alterarQuantidade(item.produto_id, 0)}
            >
              <Icone nome="lixeira" tamanho={17} />
            </button>
          </div>
        ))}
        <div className="cart-balance">
          <span className="circle-icon">
            <Icone nome="carteira" tamanho={19} />
          </span>
          <div>
            <strong>Seu saldo se pagar com saldo</strong>
            <p>
              {formatarCentavos(aluno.saldo_centavos - total)} <span>previstos</span>
            </p>
          </div>
        </div>
      </section>

      <ResumoPedido
        linhas={itens.map((item) => ({
          chave: item.produto_id,
          nome: item.nome,
          quantidade: item.quantidade,
          subtotal_centavos: item.preco_centavos * item.quantidade,
        }))}
      />

      {problemas.map((problema) => (
        <Aviso key={problema} tom="erro">
          {problema}
        </Aviso>
      ))}
      {problemas.length ? (
        <button type="button" className="button primary full" disabled>
          Agendar retirada
        </button>
      ) : (
        <Link className="button primary full" to="/aluno/retirada">
          Agendar retirada
        </Link>
      )}
      <Link className="text-link centered" to="/aluno">
        Adicionar mais produtos
      </Link>
    </div>
  )
}
