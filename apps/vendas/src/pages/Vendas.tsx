import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatarCentavos } from '@wethebest/shared'
import { cancelarVenda, listarVendas, type FiltroVendas, type VendaListada } from '../services/vendas'
import { fiadoEmAberto, type AlunoResumo } from '../services/alunos'
import { useAssincrono } from '../hooks/useAssincrono'
import { dataHora, limitesDoMes, mesAtual } from '../utils/periodo'
import { mensagemDeErro } from '../utils/erro'
import { BuscaAluno } from '../components/BuscaAluno'
import { CampoBusca } from '../components/CampoBusca'
import { Aviso } from '../components/Aviso'
import { Modal } from '../components/Modal'
import { ProdutosMaisVendidos } from '../components/ProdutosMaisVendidos'

// Mesmo prazo de prazo_cancelamento() no banco; aqui só decide se o botão aparece.
const PRAZO_CANCELAMENTO_MS = 24 * 60 * 60 * 1000

export function Vendas() {
  const [mes, setMes] = useState(mesAtual)
  const [aluno, setAluno] = useState<AlunoResumo | null>(null)
  const [cliente, setCliente] = useState<'' | 'avulsa' | 'conta'>('')
  const [origem, setOrigem] = useState<'' | 'balcao' | 'pedido'>('')
  const [texto, setTexto] = useState('')
  const [cancelando, setCancelando] = useState<VendaListada | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const vendas = useAssincrono(() => {
    const filtro: FiltroVendas = { ...limitesDoMes(mes) }
    if (aluno) filtro.alunoId = aluno.id
    if (cliente) filtro.cliente = cliente
    if (origem) filtro.origem = origem
    // O horário da carga decide quais vendas ainda mostram "Cancelar".
    return listarVendas(filtro).then((lista) => ({ lista, carregadoEm: Date.now() }))
  }, [mes, aluno, cliente, origem], 5000)
  const fiado = useAssincrono(fiadoEmAberto, [], 5000)

  const visiveis = useMemo(() => {
    const palavras = texto.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return (vendas.dados?.lista ?? []).filter((venda) => {
      const nome = (venda.aluno ?? 'cliente não registrado').toLowerCase()
      return palavras.every((palavra) => nome.includes(palavra))
    })
  }, [vendas.dados, texto])

  const confirmadas = visiveis.filter((venda) => venda.status === 'confirmada')
  const totalVendido = confirmadas.reduce((soma, venda) => soma + venda.total_centavos, 0)
  const recebidoNaHora = confirmadas
    .filter((venda) => venda.aluno_id === null)
    .reduce((soma, venda) => soma + venda.total_centavos, 0)

  function aoCancelar() {
    setCancelando(null)
    setAviso('Venda cancelada. O estoque e o saldo do aluno foram devolvidos.')
    vendas.recarregar()
    fiado.recarregar()
  }

  return (
    <main className="pagina">
      <div className="pagina-topo">
        <h1>Vendas</h1>
        <div className="acoes">
          <Link to={`/fechamento?mes=${mes}`} className="botao botao-secundario">
            Fechamento mensal
          </Link>
          <Link to="/nova-venda" className="botao botao-primario">
            + Nova venda
          </Link>
        </div>
      </div>

      <div className="filtros">
        <label className="campo">
          <span>Período</span>
          <input type="month" value={mes} max={mesAtual()} onChange={(e) => e.target.value && setMes(e.target.value)} />
        </label>
        <div className="campo">
          <span>Aluno</span>
          {aluno ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 26 }}>
              <strong>{aluno.nome}</strong>
              <button type="button" className="botao botao-fantasma" onClick={() => setAluno(null)}>
                Todos
              </button>
            </div>
          ) : (
            <BuscaAlunoCompacta aoSelecionar={setAluno} />
          )}
        </div>
        <label className="campo">
          <span>Pagamento</span>
          <select value={cliente} onChange={(e) => setCliente(e.target.value as typeof cliente)}>
            <option value="">Todos</option>
            <option value="avulsa">Na hora (sem cadastro)</option>
            <option value="conta">Conta do aluno</option>
          </select>
        </label>
        <label className="campo">
          <span>Origem</span>
          <select value={origem} onChange={(e) => setOrigem(e.target.value as typeof origem)}>
            <option value="">Balcão + pedidos</option>
            <option value="balcao">Balcão</option>
            <option value="pedido">Pedidos</option>
          </select>
        </label>
        <CampoBusca valor={texto} aoMudar={setTexto} placeholder="Buscar aluno ou venda..." />
      </div>

      <div className="kpis">
        <div className="kpi">
          <span>Total vendido</span>
          <strong>{formatarCentavos(totalVendido)}</strong>
        </div>
        <div className="kpi">
          <span>Vendas registradas</span>
          <strong>{confirmadas.length}</strong>
        </div>
        <div className="kpi">
          <span>Recebido na hora</span>
          <strong>{formatarCentavos(recebidoNaHora)}</strong>
          <small>Clientes sem cadastro</small>
        </div>
        <div className="kpi">
          <span>Fiado em aberto</span>
          <strong className={fiado.dados ? 'negativo' : undefined}>{formatarCentavos(fiado.dados ?? 0)}</strong>
          <small>Hoje, somando todos os alunos</small>
        </div>
      </div>

      {vendas.dados && <ProdutosMaisVendidos vendas={confirmadas} />}

      {aviso && <Aviso tipo="sucesso">{aviso}</Aviso>}
      {vendas.erro && <Aviso tipo="erro">{vendas.erro}</Aviso>}

      <section className="cartao cartao-sem-espaco">
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead>
              <tr>
                <th>Data</th>
                <th>Aluno</th>
                <th>Origem</th>
                <th>Pagamento</th>
                <th className="numero">Total</th>
                <th>Situação</th>
                <th>Itens</th>
                <th>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((venda) => (
                <tr key={venda.id} className={venda.status === 'cancelada' ? 'cancelada' : undefined}>
                  <td>{dataHora(venda.criado_em)}</td>
                  <td>{venda.aluno ?? <span className="texto-apoio">Cliente não registrado</span>}</td>
                  <td>{venda.origem === 'pedido' ? 'Pedido' : 'Balcão'}</td>
                  <td>{venda.aluno_id === null ? 'Na hora' : 'Conta do aluno'}</td>
                  <td className="numero">
                    <strong>{formatarCentavos(venda.total_centavos)}</strong>
                  </td>
                  <td>
                    {venda.status === 'confirmada' ? (
                      <span className="selo selo-sucesso">Confirmada</span>
                    ) : (
                      <span className="selo selo-perigo">Cancelada</span>
                    )}
                  </td>
                  <td>
                    {venda.quantidade_itens} {venda.quantidade_itens === 1 ? 'item' : 'itens'}
                  </td>
                  <td className="acoes-linha">
                    {venda.status === 'confirmada' &&
                      vendas.dados!.carregadoEm - new Date(venda.criado_em).getTime() < PRAZO_CANCELAMENTO_MS && (
                        <button type="button" className="botao botao-fantasma perigo" onClick={() => setCancelando(venda)}>
                          Cancelar
                        </button>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {vendas.carregando && !vendas.dados && <p className="vazio-bloco">Carregando vendas...</p>}
          {vendas.dados && visiveis.length === 0 && <p className="vazio-bloco">Nenhuma venda neste período.</p>}
        </div>
      </section>

      {cancelando && <CancelarVenda venda={cancelando} aoFechar={() => setCancelando(null)} aoConcluir={aoCancelar} />}
    </main>
  )
}

// A busca de aluno do filtro fica sem borda própria, dentro do cartão do filtro.
function BuscaAlunoCompacta({ aoSelecionar }: { aoSelecionar: (aluno: AlunoResumo) => void }) {
  return (
    <div className="filtro-aluno">
      <BuscaAluno aoSelecionar={aoSelecionar} placeholder="Todos os alunos" />
    </div>
  )
}

function CancelarVenda({
  venda,
  aoFechar,
  aoConcluir,
}: {
  venda: VendaListada
  aoFechar: () => void
  aoConcluir: () => void
}) {
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function confirmar() {
    setEnviando(true)
    setErro(null)
    try {
      await cancelarVenda(venda.id, motivo.trim() || undefined)
      aoConcluir()
    } catch (e) {
      setErro(mensagemDeErro(e))
      setEnviando(false)
    }
  }

  return (
    <Modal
      titulo="Cancelar venda"
      aoFechar={aoFechar}
      rodape={
        <>
          <button type="button" className="botao botao-secundario" onClick={aoFechar}>
            Voltar
          </button>
          <button type="button" className="botao botao-perigo" disabled={enviando} onClick={confirmar}>
            {enviando ? 'Cancelando...' : 'Cancelar venda'}
          </button>
        </>
      }
    >
      <p>
        Venda de <strong>{formatarCentavos(venda.total_centavos)}</strong> para{' '}
        <strong>{venda.aluno ?? 'cliente não registrado'}</strong> em {dataHora(venda.criado_em)}.
      </p>
      <p className="texto-apoio">
        Os produtos voltam ao estoque{venda.aluno_id ? ' e o valor volta ao saldo do aluno' : ''}. Só é possível
        cancelar até 24 horas depois da venda.
      </p>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <label className="campo">
        <span>Motivo (opcional)</span>
        <textarea maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </label>
    </Modal>
  )
}
