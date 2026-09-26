import { useState, type FormEvent } from 'react'
import { formatarCentavos, reaisParaCentavos } from '@wethebest/shared'
import { listarPagamentos, solicitarCredito, type CobrancaCredito, type Pagamento } from '../services/creditos'
import { useAssincrono } from '../hooks/useAssincrono'
import { mensagemDeErro } from '../utils/erro'
import { dataHora, hora } from '../utils/datas'
import { Aviso, Carregando, Falha, Modal, Vazio } from './ui'

const STATUS: Record<Pagamento['status'], string> = {
  pendente: 'Aguardando pagamento',
  pago: 'Pago',
  expirado: 'Expirado',
}

type Props = {
  alunoId: string
  nomeAluno: string
  // Avisa a tela quando uma cobrança é criada, para atualizar saldo e afins.
  aoSolicitar?: () => void
}

// Compra de crédito: gera a cobrança Pix; o saldo só muda quando o pagamento
// é confirmado pela cantina (hoje pela Carla; depois, pela API de Pix).
export function ComprarCredito({ alunoId, nomeAluno, aoSolicitar }: Props) {
  const pagamentos = useAssincrono(() => listarPagamentos(alunoId, 10), [alunoId])
  const [valor, setValor] = useState('')
  const [confirmando, setConfirmando] = useState<number | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [cobranca, setCobranca] = useState<CobrancaCredito | null>(null)

  function revisar(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)
    const centavos = reaisParaCentavos(valor)
    if (centavos === null || centavos <= 0) {
      setErro('Informe um valor maior que zero, com até duas casas decimais.')
      return
    }
    setConfirmando(centavos)
  }

  async function solicitar(centavos: number) {
    setEnviando(true)
    setErro(null)
    try {
      setCobranca(await solicitarCredito(alunoId, centavos))
      setValor('')
      setConfirmando(null)
      pagamentos.recarregar()
      aoSolicitar?.()
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <form className="form-stack credit-form" onSubmit={revisar}>
        <label>
          Comprar crédito
          <div className="money-field">
            <span>R$</span>
            <input
              aria-label="Valor do crédito"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="Digite o valor (ex.: 50,00)"
              disabled={enviando}
              required
            />
          </div>
        </label>
        {erro && confirmando === null && <Aviso tom="erro">{erro}</Aviso>}
        {cobranca && (
          <Aviso tom="sucesso">
            Cobrança de <strong>{formatarCentavos(cobranca.valor_centavos)}</strong> gerada, válida até{' '}
            {hora(cobranca.expira_em)}. Faça o pagamento à cantina: o crédito entra no saldo assim que ele for
            confirmado.
          </Aviso>
        )}
        <button type="submit" className="button primary full" disabled={enviando}>
          Gerar cobrança
        </button>
        <small>O valor só entra no saldo depois que a cantina confirmar o pagamento. Cobranças não pagas expiram em 30 minutos.</small>
      </form>

      <section className="payments" aria-label="Cobranças recentes">
        <h3>Cobranças recentes</h3>
        {pagamentos.erro ? (
          <Falha mensagem={pagamentos.erro} tentarDeNovo={pagamentos.recarregar} />
        ) : !pagamentos.dados ? (
          <Carregando />
        ) : pagamentos.dados.length === 0 ? (
          <Vazio titulo="Nenhuma cobrança ainda" icone="carteira" />
        ) : (
          <ul className="payment-list">
            {pagamentos.dados.map((pagamento) => (
              <li key={pagamento.id}>
                <span>
                  <strong>{pagamento.tipo === 'credito' ? 'Crédito' : 'Pedido'}</strong>
                  <small>{dataHora(pagamento.criado_em)}</small>
                </span>
                <span className={`status-pill ${pagamento.status}`}>{STATUS[pagamento.status]}</span>
                <b>{formatarCentavos(pagamento.valor_centavos)}</b>
              </li>
            ))}
          </ul>
        )}
      </section>

      {confirmando !== null && (
        <Modal titulo="Confirmar compra de crédito" aoFechar={() => !enviando && setConfirmando(null)}>
          <p>
            Gerar uma cobrança de <strong>{formatarCentavos(confirmando)}</strong> para {nomeAluno}?
          </p>
          <Aviso>O saldo muda só depois que a cantina confirmar o pagamento.</Aviso>
          {erro && <Aviso tom="erro">{erro}</Aviso>}
          <div className="button-row">
            <button type="button" className="button secondary" disabled={enviando} onClick={() => setConfirmando(null)}>
              Voltar
            </button>
            <button type="button" className="button primary" disabled={enviando} onClick={() => void solicitar(confirmando)}>
              {enviando ? 'Gerando…' : 'Confirmar'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
