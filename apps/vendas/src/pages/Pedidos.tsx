import { useState } from 'react'
import { formatarCentavos, hojeEmSaoPaulo, somarDias } from '@wethebest/shared'
import { finalizarPedido, listarPedidos, type PedidoRetirada, type StatusPedido } from '../services/pedidos'
import { listarIntervalos } from '../services/intervalos'
import { useAssincrono } from '../hooks/useAssincrono'
import { dataCurta } from '../utils/periodo'
import { mensagemDeErro } from '../utils/erro'
import { Aviso } from '../components/Aviso'
import { Modal } from '../components/Modal'

const STATUS: Record<StatusPedido, { rotulo: string; classe: string }> = {
  aguardando_pagamento: { rotulo: 'Aguardando Pix', classe: 'selo-alerta' },
  pago: { rotulo: 'Pago, a retirar', classe: 'selo-info' },
  entregue: { rotulo: 'Entregue', classe: 'selo-sucesso' },
  nao_retirado: { rotulo: 'Não retirado', classe: 'selo-perigo' },
  expirado: { rotulo: 'Expirado', classe: '' },
  recusado: { rotulo: 'Recusado', classe: 'selo-perigo' },
  cancelado: { rotulo: 'Cancelado', classe: '' },
}

const FILTROS_STATUS: Record<string, { rotulo: string; status?: StatusPedido[] }> = {
  retirar: { rotulo: 'A retirar', status: ['pago'] },
  pix: { rotulo: 'Aguardando Pix', status: ['aguardando_pagamento'] },
  finalizados: { rotulo: 'Finalizados', status: ['entregue', 'nao_retirado'] },
  todos: { rotulo: 'Todos' },
}

export function Pedidos() {
  const hoje = hojeEmSaoPaulo()
  const [data, setData] = useState(hoje)
  const [intervaloId, setIntervaloId] = useState('')
  const [filtro, setFiltro] = useState('retirar')
  const [naoRetirado, setNaoRetirado] = useState<PedidoRetirada | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)

  const intervalos = useAssincrono(listarIntervalos, [])
  const pedidos = useAssincrono(
    () => listarPedidos(data, { intervaloId: intervaloId || undefined, status: FILTROS_STATUS[filtro].status }),
    [data, intervaloId, filtro],
  )

  async function finalizar(pedido: PedidoRetirada, entregue: boolean) {
    setOcupado(pedido.id)
    setErro(null)
    try {
      await finalizarPedido(pedido.id, entregue)
      setNaoRetirado(null)
      pedidos.recarregar()
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setOcupado(null)
    }
  }

  return (
    <main className="pagina">
      <div className="pagina-topo">
        <div>
          <h1>Fila de pedidos</h1>
          <p className="subtitulo">Pedidos antecipados dos alunos para retirada no balcão.</p>
        </div>
        <button type="button" className="botao botao-secundario" onClick={pedidos.recarregar}>
          Atualizar
        </button>
      </div>

      <div className="filtros" style={{ gridTemplateColumns: 'repeat(3, minmax(160px, 1fr))' }}>
        <label className="campo">
          <span>Dia</span>
          <select value={data} onChange={(e) => setData(e.target.value)}>
            <option value={hoje}>Hoje ({dataCurta(hoje)})</option>
            <option value={somarDias(hoje, 1)}>Amanhã ({dataCurta(somarDias(hoje, 1))})</option>
            <option value={somarDias(hoje, -1)}>Ontem ({dataCurta(somarDias(hoje, -1))})</option>
          </select>
        </label>
        <label className="campo">
          <span>Intervalo</span>
          <select value={intervaloId} onChange={(e) => setIntervaloId(e.target.value)}>
            <option value="">Todos</option>
            {intervalos.dados?.map((intervalo) => (
              <option key={intervalo.id} value={intervalo.id}>
                {intervalo.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Situação</span>
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            {Object.entries(FILTROS_STATUS).map(([valor, { rotulo }]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </label>
      </div>

      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {pedidos.erro && <Aviso tipo="erro">{pedidos.erro}</Aviso>}
      {pedidos.dados?.length === 0 && <div className="cartao vazio-bloco">Nenhum pedido nesta seleção.</div>}

      <div className="pedidos-grade">
        {pedidos.dados?.map((pedido) => (
          <article key={pedido.id} className="cartao pedido">
            <div className="cartao-cabecalho" style={{ margin: 0 }}>
              <h2>{pedido.aluno ?? 'Aluno'}</h2>
              <span className={`selo ${STATUS[pedido.status].classe}`}>{STATUS[pedido.status].rotulo}</span>
            </div>
            <p className="texto-apoio">
              {pedido.intervalo ?? 'Intervalo'} • {pedido.forma_pagamento === 'pix' ? 'Pix' : 'Saldo'} •{' '}
              <strong>{formatarCentavos(pedido.total_centavos)}</strong>
            </p>
            <ul>
              {pedido.itens.map((item, i) => (
                <li key={i}>
                  {item.quantidade}× {item.nome_produto}
                </li>
              ))}
            </ul>
            {pedido.observacao && <p className="texto-apoio">Obs.: {pedido.observacao}</p>}
            {pedido.motivo && <p className="texto-apoio">Motivo: {pedido.motivo}</p>}
            {pedido.status === 'pago' && (
              <div className="pedido-rodape">
                <button
                  type="button"
                  className="botao botao-primario"
                  disabled={ocupado === pedido.id}
                  onClick={() => finalizar(pedido, true)}
                >
                  Entregue
                </button>
                <button type="button" className="botao botao-secundario" onClick={() => setNaoRetirado(pedido)}>
                  Não retirado
                </button>
              </div>
            )}
          </article>
        ))}
      </div>

      {naoRetirado && (
        <Modal
          titulo="Marcar como não retirado?"
          aoFechar={() => setNaoRetirado(null)}
          rodape={
            <>
              <button type="button" className="botao botao-secundario" onClick={() => setNaoRetirado(null)}>
                Voltar
              </button>
              <button
                type="button"
                className="botao botao-perigo"
                disabled={ocupado === naoRetirado.id}
                onClick={() => finalizar(naoRetirado, false)}
              >
                Não retirado
              </button>
            </>
          }
        >
          <p>
            O pedido de <strong>{naoRetirado.aluno}</strong> ({formatarCentavos(naoRetirado.total_centavos)}) será
            encerrado. Pela regra da cantina, o valor não é devolvido.
          </p>
        </Modal>
      )}
    </main>
  )
}
