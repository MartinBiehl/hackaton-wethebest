import { useState } from 'react'
import { formatarCentavos } from '@wethebest/shared'
import {
  confirmarPagamento,
  listarPagamentosAbertos,
  type PagamentoAberto,
  type ResultadoConfirmacao,
} from '../services/pagamentos'
import { useAssincrono } from '../hooks/useAssincrono'
import { dataHora } from '../utils/periodo'
import { mensagemDeErro } from '../utils/erro'
import { Aviso } from '../components/Aviso'
import { Modal } from '../components/Modal'

const RESULTADOS: Record<ResultadoConfirmacao['status'], string> = {
  creditado: 'Pagamento confirmado. O crédito entrou no saldo do aluno.',
  pedido_pago: 'Pagamento confirmado. O pedido foi pago e entrou na fila de retirada.',
  pedido_recusado: 'Pagamento confirmado, mas o pedido foi recusado. O valor ficou como crédito do aluno.',
  pedido_expirado: 'Pagamento confirmado, mas o pedido passou do prazo. O valor ficou como crédito do aluno.',
  ja_confirmado: 'Este pagamento já havia sido confirmado.',
}

// Provisório até a integração com a API de Pix: a Carla confirma o que recebeu.
export function Pagamentos() {
  const pagamentos = useAssincrono(listarPagamentosAbertos, [], 5000)
  const [confirmando, setConfirmando] = useState<PagamentoAberto | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<string | null>(null)

  async function confirmar(pagamento: PagamentoAberto) {
    setEnviando(true)
    setErro(null)
    try {
      const retorno = await confirmarPagamento(pagamento.id)
      setResultado(RESULTADOS[retorno.status])
      setConfirmando(null)
      pagamentos.recarregar()
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="pagina">
      <div className="pagina-topo">
        <div>
          <h1>Pagamentos Pix</h1>
          <p className="subtitulo">Cobranças de crédito e de pedidos ainda não confirmadas.</p>
        </div>
        <button type="button" className="botao botao-secundario" onClick={pagamentos.recarregar}>
          Atualizar
        </button>
      </div>

      <Aviso tipo="alerta">
        Confirme apenas pagamentos que já entraram na conta da cantina. A confirmação lança o valor no saldo do aluno.
      </Aviso>
      {resultado && <Aviso tipo="sucesso">{resultado}</Aviso>}
      {pagamentos.erro && <Aviso tipo="erro">{pagamentos.erro}</Aviso>}

      <section className="cartao cartao-sem-espaco">
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead>
              <tr>
                <th>Criado em</th>
                <th>Aluno</th>
                <th>Tipo</th>
                <th className="numero">Valor</th>
                <th>Situação</th>
                <th>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pagamentos.dados?.map((pagamento) => (
                <tr key={pagamento.id}>
                  <td>{dataHora(pagamento.criado_em)}</td>
                  <td>{pagamento.aluno ?? '—'}</td>
                  <td>{pagamento.tipo === 'pedido' ? 'Pedido antecipado' : 'Compra de crédito'}</td>
                  <td className="numero">
                    <strong>{formatarCentavos(pagamento.valor_centavos)}</strong>
                  </td>
                  <td>
                    {pagamento.status === 'pendente' ? (
                      <span className="selo selo-alerta">Pendente até {dataHora(pagamento.expira_em)}</span>
                    ) : (
                      <span className="selo">Expirado</span>
                    )}
                  </td>
                  <td className="acoes-linha">
                    <button type="button" className="botao botao-fantasma" onClick={() => setConfirmando(pagamento)}>
                      Confirmar recebimento
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pagamentos.dados?.length === 0 && <p className="vazio-bloco">Nenhum pagamento aguardando confirmação.</p>}
        </div>
      </section>

      {confirmando && (
        <Modal
          titulo="Confirmar recebimento"
          aoFechar={() => setConfirmando(null)}
          rodape={
            <>
              <button type="button" className="botao botao-secundario" onClick={() => setConfirmando(null)}>
                Voltar
              </button>
              <button
                type="button"
                className="botao botao-primario"
                disabled={enviando}
                onClick={() => confirmar(confirmando)}
              >
                {enviando ? 'Confirmando...' : 'Recebi o pagamento'}
              </button>
            </>
          }
        >
          <p>
            Pix de <strong>{formatarCentavos(confirmando.valor_centavos)}</strong> de{' '}
            <strong>{confirmando.aluno ?? 'aluno'}</strong>.
          </p>
          {confirmando.status === 'expirado' && (
            <p className="texto-apoio">
              A cobrança expirou. Se o dinheiro chegou mesmo assim, o valor entra como crédito do aluno.
            </p>
          )}
          {erro && <Aviso tipo="erro">{erro}</Aviso>}
        </Modal>
      )}
    </main>
  )
}
