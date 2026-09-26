import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatarCentavos } from '@wethebest/shared'
import { listarCardapio, listarIntervalos } from '../../services/cardapio'
import { criarPedido, datasDisponiveis, type FormaPagamento } from '../../services/pedidos'
import { useAssincrono } from '../../hooks/useAssincrono'
import { useAluno } from '../../hooks/useAluno'
import { totalDoCarrinho, useCarrinho } from '../../hooks/useCarrinho'
import { corteDoPedido, dataCurta, dataLonga, horario } from '../../utils/datas'
import { mensagemDeErro } from '../../utils/erro'
import { problemasDoPedido } from '../../utils/pedido'
import { ResumoPedido } from '../../components/ResumoPedido'
import { Aviso, Carregando, Etapas, Falha, Voltar } from '../../components/ui'

const ROTULO_DIA = ['Hoje', 'Amanhã']

export function AgendarPedido() {
  const { aluno, recarregarAluno } = useAluno()
  const carrinho = useCarrinho()
  const navigate = useNavigate()
  const dados = useAssincrono(() => Promise.all([listarIntervalos(), listarCardapio()]), [])
  const [datas] = useState(datasDisponiveis)
  const [dataEscolhida, setDataEscolhida] = useState<string | null>(null)
  const [intervaloId, setIntervaloId] = useState<string | null>(null)
  const [formaEscolhida, setFormaEscolhida] = useState<FormaPagamento | null>(null)
  const [observacao, setObservacao] = useState('')
  const [agora, setAgora] = useState(() => Date.now())
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const travado = useRef(false)

  // Os intervalos fecham com a tela aberta; o relógio atualiza os botões.
  useEffect(() => {
    const id = window.setInterval(() => setAgora(Date.now()), 15000)
    return () => window.clearInterval(id)
  }, [])

  if (!carrinho.itens.length) {
    return (
      <div className="narrow-page">
        <Voltar para="/aluno">Voltar ao cardápio</Voltar>
        <h1>Agendar retirada</h1>
        <Aviso>
          Seu pedido está vazio. <Link to="/aluno">Escolha os produtos no cardápio.</Link>
        </Aviso>
      </div>
    )
  }

  if (!dados.dados) return dados.erro ? <Falha mensagem={dados.erro} tentarDeNovo={dados.recarregar} /> : <Carregando />

  const [intervalos, cardapio] = dados.dados
  const aberto = (data: string, inicio: string) => agora < corteDoPedido(data, inicio)
  const data = dataEscolhida ?? datas.find((d) => intervalos.some((i) => aberto(d, i.inicio))) ?? datas[0]
  const intervalo = intervalos.find((i) => i.id === intervaloId && aberto(data, i.inicio)) ?? null

  const precos = new Map(cardapio.map((produto) => [produto.id, produto.preco_centavos]))
  const itens = carrinho.itens.map((item) => ({ ...item, preco_centavos: precos.get(item.produto_id) ?? item.preco_centavos }))
  const total = totalDoCarrinho(itens)
  const disponivel = new Map(cardapio.map((produto) => [produto.id, produto.disponivel]))
  const problemas = problemasDoPedido(itens, disponivel, aluno.gasto_mes_centavos, aluno.limite_mensal_centavos)

  // Pedido com saldo não vira fiado: exige saldo suficiente.
  const saldoCobre = aluno.saldo_centavos >= total
  const forma: FormaPagamento = formaEscolhida ?? (saldoCobre ? 'saldo' : 'pix')
  const podeConfirmar = intervalo !== null && !problemas.length && (forma === 'pix' || saldoCobre) && !enviando

  async function confirmar() {
    if (travado.current || !intervalo) return
    travado.current = true
    setEnviando(true)
    setErro(null)
    try {
      const resultado = await criarPedido({
        intervaloId: intervalo.id,
        dataRetirada: data,
        itens: itens.map((item) => ({ produto_id: item.produto_id, quantidade: item.quantidade })),
        forma,
        observacao: observacao.trim() || undefined,
      })
      carrinho.limpar()
      recarregarAluno()
      navigate(`/aluno/pedidos/${resultado.pedido_id}`, { replace: true })
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      travado.current = false
      setEnviando(false)
    }
  }

  return (
    <div className="narrow-page">
      <Voltar para="/aluno/pedido">Voltar</Voltar>
      <h1>Agendar retirada</h1>
      <Etapas atual={2} />

      <section className="card form-stack">
        <fieldset className="day-fields">
          <legend>Dia da retirada</legend>
          {datas.map((d, indice) => (
            <label key={d} className={d === data ? 'slot selected' : 'slot'}>
              <input
                type="radio"
                name="data"
                checked={d === data}
                onChange={() => {
                  setDataEscolhida(d)
                  setIntervaloId(null)
                }}
              />
              <span>
                <strong>{ROTULO_DIA[indice]}</strong>
                <small>{dataCurta(d)}</small>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="slot-fields">
          <legend>Intervalo de retirada</legend>
          {intervalos.length === 0 && <Aviso>A cantina ainda não cadastrou intervalos de retirada.</Aviso>}
          {intervalos.map((i) => {
            const livre = aberto(data, i.inicio)
            const classes = ['slot', intervalo?.id === i.id ? 'selected' : '', livre ? '' : 'disabled'].join(' ')
            return (
              <label key={i.id} className={classes}>
                <input
                  type="radio"
                  name="intervalo"
                  checked={intervalo?.id === i.id}
                  disabled={!livre}
                  onChange={() => setIntervaloId(i.id)}
                />
                <span>
                  <strong>{i.nome}</strong>
                  <small>
                    {horario(i.inicio)} às {horario(i.fim)}
                    {livre ? '' : ' · Pedidos encerrados'}
                  </small>
                </span>
              </label>
            )
          })}
        </fieldset>
        <small>Os pedidos fecham 30 minutos antes do início do intervalo.</small>

        <fieldset className="slot-fields">
          <legend>Pagamento</legend>
          <label className={['slot', forma === 'saldo' ? 'selected' : '', saldoCobre ? '' : 'disabled'].join(' ')}>
            <input
              type="radio"
              name="forma"
              checked={forma === 'saldo'}
              disabled={!saldoCobre}
              onChange={() => setFormaEscolhida('saldo')}
            />
            <span>
              <strong>Saldo da conta</strong>
              <small>
                {saldoCobre
                  ? `Saldo atual ${formatarCentavos(aluno.saldo_centavos)}. O pedido já sai pago.`
                  : `Saldo insuficiente (${formatarCentavos(aluno.saldo_centavos)}). Compre créditos ou pague com Pix.`}
              </small>
            </span>
          </label>
          <label className={forma === 'pix' ? 'slot selected' : 'slot'}>
            <input type="radio" name="forma" checked={forma === 'pix'} onChange={() => setFormaEscolhida('pix')} />
            <span>
              <strong>Pix</strong>
              <small>A cobrança vale por 30 minutos. O pedido é confirmado quando a cantina receber o pagamento.</small>
            </span>
          </label>
        </fieldset>

        <label>
          Observação (opcional)
          <textarea
            maxLength={300}
            rows={2}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Ex.: sem cebola"
          />
        </label>
      </section>

      <ResumoPedido
        linhas={itens.map((item) => ({
          chave: item.produto_id,
          nome: item.nome,
          quantidade: item.quantidade,
          subtotal_centavos: item.preco_centavos * item.quantidade,
        }))}
      />

      {intervalo && (
        <div className="selected-pickup">
          <span>RETIRADA SELECIONADA</span>
          <strong>
            {dataLonga(data)} · {intervalo.nome} ({horario(intervalo.inicio)})
          </strong>
        </div>
      )}
      {problemas.map((problema) => (
        <Aviso key={problema} tom="erro">
          {problema}
        </Aviso>
      ))}
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      <button type="button" className="button primary full" disabled={!podeConfirmar} onClick={() => void confirmar()}>
        {enviando ? 'Confirmando…' : forma === 'pix' ? 'Confirmar e gerar Pix' : 'Confirmar pedido'}
      </button>
    </div>
  )
}
