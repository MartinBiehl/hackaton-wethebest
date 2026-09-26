import { useEffect, useMemo, useState } from 'react'
import { formatarCentavos } from '@wethebest/shared'
import { listarProdutos, urlFoto, type Produto } from '../services/produtos'
import { situacaoFinanceira, type AlunoResumo, type SituacaoFinanceira } from '../services/alunos'
import { registrarVenda } from '../services/vendas'
import { useAssincrono } from '../hooks/useAssincrono'
import { mensagemDeErro } from '../utils/erro'
import { BuscaAluno } from '../components/BuscaAluno'
import { CampoBusca } from '../components/CampoBusca'
import { Aviso } from '../components/Aviso'
import { IconeLixeira, IconeMais, IconeMenos, IconeUsuario } from '../components/Icones'

// Mesmo valor de piso_saldo_centavos() no banco. Aqui só serve para avisar antes;
// quem recusa a venda é a função registrar_venda.
const PISO_DIVIDA_CENTAVOS = -25000

type Cliente = { tipo: 'aluno'; aluno: AlunoResumo } | { tipo: 'avulso' }
type Item = { produto: Produto; quantidade: number }

export function NovaVenda() {
  const produtos = useAssincrono(() => listarProdutos(), [])
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [situacao, setSituacao] = useState<{ alunoId: string; dados: SituacaoFinanceira } | null>(null)
  const [buscaProduto, setBuscaProduto] = useState('')
  const [itens, setItens] = useState<Item[]>([])
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  const alunoId = cliente?.tipo === 'aluno' ? cliente.aluno.id : null

  useEffect(() => {
    if (!alunoId) return
    let ativo = true
    situacaoFinanceira(alunoId).then(
      (dados) => ativo && setSituacao({ alunoId, dados }),
      (e) => ativo && setErro(mensagemDeErro(e)),
    )
    return () => {
      ativo = false
    }
  }, [alunoId])

  const financeiro = alunoId && situacao?.alunoId === alunoId ? situacao.dados : null

  const produtosFiltrados = useMemo(() => {
    const palavras = buscaProduto.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return (produtos.dados ?? []).filter((p) => palavras.every((palavra) => p.nome.toLowerCase().includes(palavra)))
  }, [produtos.dados, buscaProduto])

  const total = itens.reduce((soma, item) => soma + item.produto.preco_centavos * item.quantidade, 0)
  const quantidadeTotal = itens.reduce((soma, item) => soma + item.quantidade, 0)

  function escolherCliente(novo: Cliente) {
    setCliente(novo)
    setErro(null)
    setSucesso(null)
  }

  function adicionar(produto: Produto) {
    setSucesso(null)
    setItens((atuais) => {
      const existente = atuais.find((item) => item.produto.id === produto.id)
      if (!existente) return [...atuais, { produto, quantidade: 1 }]
      if (existente.quantidade >= produto.estoque) return atuais
      return atuais.map((item) => (item === existente ? { ...item, quantidade: item.quantidade + 1 } : item))
    })
  }

  function mudarQuantidade(produtoId: string, delta: number) {
    setItens((atuais) =>
      atuais
        .map((item) =>
          item.produto.id === produtoId
            ? { ...item, quantidade: Math.min(item.quantidade + delta, item.produto.estoque) }
            : item,
        )
        .filter((item) => item.quantidade > 0),
    )
  }

  async function registrar() {
    if (!cliente || itens.length === 0) return
    setEnviando(true)
    setErro(null)
    try {
      const venda = await registrarVenda(
        alunoId,
        itens.map((item) => ({ produto_id: item.produto.id, quantidade: item.quantidade })),
      )
      const quem = cliente.tipo === 'aluno' ? cliente.aluno.nome : 'cliente não registrado'
      const saldo = venda.saldo_centavos === null ? '' : ` Saldo do aluno agora: ${formatarCentavos(venda.saldo_centavos)}.`
      setSucesso(`Venda de ${formatarCentavos(venda.total_centavos)} registrada para ${quem}.${saldo}`)
      setItens([])
      setCliente(null)
      setSituacao(null)
      produtos.recarregar()
    } catch (e) {
      setErro(mensagemDeErro(e))
      // O estoque pode ter mudado desde que a lista foi carregada.
      produtos.recarregar()
    } finally {
      setEnviando(false)
    }
  }

  const saldoDepois = financeiro ? financeiro.saldo_centavos - total : null
  const fiado = saldoDepois !== null && saldoDepois < 0 ? Math.min(-saldoDepois, total) : 0
  const passaDoPiso = saldoDepois !== null && total > 0 && saldoDepois < PISO_DIVIDA_CENTAVOS
  const passaDoLimite =
    financeiro?.limite_mensal_centavos != null &&
    total > 0 &&
    financeiro.gasto_mes_centavos + total > financeiro.limite_mensal_centavos

  return (
    <main className="pagina">
      <h1>Nova venda</h1>

      <div className="venda-layout">
        <div className="venda-coluna">
          {sucesso && <Aviso tipo="sucesso">{sucesso}</Aviso>}

          <section className="cartao">
            <p className="rotulo" style={{ marginBottom: 8 }}>
              Aluno
            </p>
            {cliente ? (
              <div className="cliente-escolhido">
                <div>
                  <IconeUsuario />
                  {cliente.tipo === 'aluno' ? cliente.aluno.nome : 'Cliente não registrado'}
                </div>
                <button type="button" className="botao botao-fantasma" onClick={() => setCliente(null)}>
                  Trocar
                </button>
              </div>
            ) : (
              <>
                <BuscaAluno aoSelecionar={(aluno) => escolherCliente({ tipo: 'aluno', aluno })} autoFocus />
                <div className="cliente-alternativa">
                  Sem cadastro?{' '}
                  <button
                    type="button"
                    className="botao botao-fantasma"
                    onClick={() => escolherCliente({ tipo: 'avulso' })}
                  >
                    Vender para cliente não registrado
                  </button>
                </div>
              </>
            )}
          </section>

          <CampoBusca valor={buscaProduto} aoMudar={setBuscaProduto} placeholder="Pesquisar produto pelo nome..." />

          {cliente?.tipo === 'aluno' && (
            <div className="faixa-info">
              <span>
                Aluno: <strong>{cliente.aluno.nome}</strong>
              </span>
              {financeiro ? (
                <>
                  <span>
                    {financeiro.saldo_centavos >= 0 ? 'Crédito disponível: ' : 'Em aberto (fiado): '}
                    <strong className={financeiro.saldo_centavos < 0 ? 'negativo' : undefined}>
                      {formatarCentavos(Math.abs(financeiro.saldo_centavos))}
                    </strong>
                  </span>
                  <span>
                    Gasto no mês: <strong>{formatarCentavos(financeiro.gasto_mes_centavos)}</strong>
                    {financeiro.limite_mensal_centavos != null &&
                      ` de ${formatarCentavos(financeiro.limite_mensal_centavos)}`}
                  </span>
                </>
              ) : (
                <span>Carregando saldo...</span>
              )}
            </div>
          )}

          {produtos.erro && <Aviso tipo="erro">{produtos.erro}</Aviso>}
          {produtos.dados && produtosFiltrados.length === 0 && (
            <div className="cartao vazio-bloco">
              {produtos.dados.length === 0 ? 'Nenhum produto ativo. Cadastre em Produtos.' : 'Nenhum produto encontrado.'}
            </div>
          )}
          <div className="produtos-grade">
            {produtosFiltrados.map((produto) => {
              const foto = urlFoto(produto.foto_path)
              const noCarrinho = itens.find((item) => item.produto.id === produto.id)?.quantidade ?? 0
              return (
                <button
                  key={produto.id}
                  type="button"
                  className="produto-botao"
                  disabled={produto.estoque - noCarrinho <= 0}
                  onClick={() => adicionar(produto)}
                >
                  {foto && <img src={foto} alt="" loading="lazy" />}
                  <span>
                    <strong>{produto.nome}</strong>
                    <span className="preco">{formatarCentavos(produto.preco_centavos)}</span>
                    <small>{produto.estoque > 0 ? `${produto.estoque} em estoque` : 'Sem estoque'}</small>
                  </span>
                </button>
              )
            })}
          </div>

          <section className="cartao cartao-sem-espaco">
            <div className="cartao-cabecalho">
              <h2>Itens da venda</h2>
              <span className="texto-apoio">
                {quantidadeTotal} {quantidadeTotal === 1 ? 'item' : 'itens'}
              </span>
            </div>
            {itens.length === 0 ? (
              <p className="vazio-bloco">Toque em um produto para adicioná-lo.</p>
            ) : (
              <div className="tabela-rolagem">
                <table className="tabela">
                  <thead className="sr-only">
                    <tr>
                      <th>Produto</th>
                      <th>Quantidade</th>
                      <th>Preço</th>
                      <th>Subtotal</th>
                      <th>Remover</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((item) => (
                      <tr key={item.produto.id}>
                        <td>{item.produto.nome}</td>
                        <td>
                          <span className="quantidade">
                            <button
                              type="button"
                              className="botao-icone"
                              aria-label={`Diminuir ${item.produto.nome}`}
                              onClick={() => mudarQuantidade(item.produto.id, -1)}
                            >
                              <IconeMenos tamanho={14} />
                            </button>
                            <span>{item.quantidade}</span>
                            <button
                              type="button"
                              className="botao-icone"
                              aria-label={`Aumentar ${item.produto.nome}`}
                              disabled={item.quantidade >= item.produto.estoque}
                              onClick={() => mudarQuantidade(item.produto.id, 1)}
                            >
                              <IconeMais tamanho={14} />
                            </button>
                          </span>
                        </td>
                        <td className="numero texto-apoio">{formatarCentavos(item.produto.preco_centavos)}</td>
                        <td className="numero">
                          <strong>{formatarCentavos(item.produto.preco_centavos * item.quantidade)}</strong>
                        </td>
                        <td className="acoes-linha">
                          <button
                            type="button"
                            className="botao-icone perigo"
                            aria-label={`Remover ${item.produto.nome}`}
                            onClick={() => mudarQuantidade(item.produto.id, -item.quantidade)}
                          >
                            <IconeLixeira />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="venda-coluna venda-lateral">
          <section className="cartao">
            <h2 style={{ marginBottom: 12 }}>Resumo</h2>
            <div className="resumo-linha">
              <span>Itens</span>
              <strong>{quantidadeTotal}</strong>
            </div>
            <div className="resumo-linha resumo-total">
              <span>Total</span>
              <strong>{formatarCentavos(total)}</strong>
            </div>
          </section>

          <section className="cartao">
            <h2 style={{ marginBottom: 12 }}>Forma de pagamento</h2>
            {!cliente && <p className="texto-apoio">Escolha o aluno ou cliente não registrado.</p>}
            {cliente?.tipo === 'avulso' && (
              <div className="pagamento-opcao">
                <strong>Pago na hora</strong>
                <p>Cliente sem cadastro paga no balcão. A venda entra no caixa do mês, fora do extrato de alunos.</p>
              </div>
            )}
            {cliente?.tipo === 'aluno' && (
              <div className="pagamento-opcao">
                <strong>Debitado do saldo do aluno</strong>
                <p>Sai do crédito do aluno. O que faltar fica em aberto (fiado), até R$ 250,00.</p>
                {financeiro && total > 0 && (
                  <>
                    <div className="resumo-linha">
                      <span>Saldo depois da venda</span>
                      <strong className={saldoDepois! < 0 ? 'negativo' : undefined}>
                        {formatarCentavos(saldoDepois!)}
                      </strong>
                    </div>
                    {fiado > 0 && <p>{formatarCentavos(fiado)} desta venda ficará como fiado.</p>}
                  </>
                )}
              </div>
            )}
            {passaDoPiso && (
              <div style={{ marginTop: 10 }}>
                <Aviso tipo="alerta">A venda passa do limite de dívida de R$ 250,00 e deve ser recusada.</Aviso>
              </div>
            )}
            {passaDoLimite && (
              <div style={{ marginTop: 10 }}>
                <Aviso tipo="alerta">A venda passa do limite mensal definido pelo responsável.</Aviso>
              </div>
            )}
          </section>

          {erro && <Aviso tipo="erro">{erro}</Aviso>}

          <button
            type="button"
            className="botao botao-grande"
            disabled={!cliente || itens.length === 0 || enviando}
            onClick={registrar}
          >
            {enviando ? 'Registrando...' : `Registrar venda • ${formatarCentavos(total)}`}
          </button>
        </aside>
      </div>
    </main>
  )
}
