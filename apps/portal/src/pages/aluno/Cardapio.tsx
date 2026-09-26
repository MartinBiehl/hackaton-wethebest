import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatarCentavos } from '@wethebest/shared'
import { listarCardapio, type ItemCardapio } from '../../services/cardapio'
import { useAssincrono } from '../../hooks/useAssincrono'
import { useAluno } from '../../hooks/useAluno'
import { MAXIMO_POR_ITEM, useCarrinho } from '../../hooks/useCarrinho'
import { normalizar, primeiroNome } from '../../utils/texto'
import { Icone } from '../../components/Icone'
import { ResumoPedido } from '../../components/ResumoPedido'
import { Carregando, Falha, Indicador, Vazio } from '../../components/ui'

export function Cardapio() {
  const { aluno } = useAluno()
  const carrinho = useCarrinho()
  const cardapio = useAssincrono(listarCardapio, [])
  const [busca, setBusca] = useState('')
  const [mensagem, setMensagem] = useState('')

  function noCarrinho(produtoId: string): number {
    return carrinho.itens.find((item) => item.produto_id === produtoId)?.quantidade ?? 0
  }

  function adicionar(produto: ItemCardapio) {
    const atual = noCarrinho(produto.id)
    if (atual >= Math.min(produto.disponivel, MAXIMO_POR_ITEM)) {
      setMensagem(`Não há mais unidades de ${produto.nome} disponíveis agora.`)
      return
    }
    carrinho.alterar(
      atual
        ? carrinho.itens.map((item) =>
            item.produto_id === produto.id
              ? { ...item, preco_centavos: produto.preco_centavos, quantidade: item.quantidade + 1 }
              : item,
          )
        : [
            ...carrinho.itens,
            { produto_id: produto.id, nome: produto.nome, preco_centavos: produto.preco_centavos, quantidade: 1 },
          ],
    )
    setMensagem(`${produto.nome} adicionado ao pedido.`)
  }

  const termo = normalizar(busca)
  const produtos = (cardapio.dados ?? []).filter((produto) => normalizar(produto.nome).includes(termo))

  return (
    <>
      <section className="welcome-row">
        <h1>Olá, {primeiroNome(aluno.nome)}!</h1>
        <div className="balance-pair">
          <Indicador rotulo="Saldo disponível" valor={formatarCentavos(aluno.saldo_centavos)} destaque />
          <Indicador
            rotulo="Limite mensal"
            valor={aluno.limite_mensal_centavos === null ? 'Sem limite' : formatarCentavos(aluno.limite_mensal_centavos)}
          />
        </div>
      </section>

      <div className="catalog-layout">
        <section>
          <h2 className="section-title">Comprar na cantina</h2>
          <label className="search-field">
            <Icone nome="busca" tamanho={19} />
            <input
              type="search"
              aria-label="Pesquisar item"
              placeholder="Pesquisar item…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </label>
          <p className="cart-feedback" role="status">
            {mensagem || ' '}
          </p>

          {cardapio.erro && !cardapio.dados ? (
            <Falha mensagem={cardapio.erro} tentarDeNovo={cardapio.recarregar} />
          ) : !cardapio.dados ? (
            <Carregando />
          ) : produtos.length === 0 ? (
            <Vazio titulo="Nenhum item encontrado" icone="busca">
              {busca ? 'Tente outro nome.' : 'O cardápio ainda está vazio.'}
            </Vazio>
          ) : (
            <div className="products">
              {produtos.map((produto) => {
                const esgotado = produto.disponivel <= 0
                return (
                  <article className="product-card" key={produto.id}>
                    <div className="product-heading">
                      {produto.foto_url ? (
                        <img className="product-photo" src={produto.foto_url} alt="" loading="lazy" />
                      ) : (
                        <span className="product-icon">
                          <Icone nome="lanche" tamanho={23} />
                        </span>
                      )}
                      <div>
                        <h3>{produto.nome}</h3>
                        {produto.descricao && <p>{produto.descricao}</p>}
                        <p>{esgotado ? 'Esgotado agora' : `${produto.disponivel} disponíveis agora`}</p>
                      </div>
                    </div>
                    <div className="product-bottom">
                      <strong>{formatarCentavos(produto.preco_centavos)}</strong>
                      <button
                        type="button"
                        className="button primary add-button"
                        disabled={esgotado}
                        onClick={() => adicionar(produto)}
                        aria-label={`Adicionar ${produto.nome}`}
                      >
                        {esgotado ? (
                          'Esgotado'
                        ) : (
                          <>
                            <Icone nome="mais" tamanho={15} />
                            Adicionar
                          </>
                        )}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
          <p className="fine-print left">O estoque não é reservado: o produto só fica garantido quando o pedido é pago.</p>
        </section>

        <aside className="cart-aside">
          {carrinho.itens.length ? (
            <ResumoPedido
              linhas={carrinho.itens.map((item) => ({
                chave: item.produto_id,
                nome: item.nome,
                quantidade: item.quantidade,
                subtotal_centavos: item.preco_centavos * item.quantidade,
              }))}
            >
              <Link className="button primary full" to="/aluno/pedido">
                Continuar
              </Link>
            </ResumoPedido>
          ) : (
            <section className="card">
              <Vazio titulo="Meu pedido" icone="sacola">
                Adicione produtos para montar seu lanche.
              </Vazio>
            </section>
          )}
        </aside>
      </div>
    </>
  )
}
