import { Link, useParams, useSearchParams } from 'react-router-dom'
import { formatarCentavos } from '@wethebest/shared'
import { listarAlunos } from '../../services/alunos'
import { listarExtratoDoMes, MOVIMENTOS_POR_PAGINA } from '../../services/extrato'
import { useAssincrono } from '../../hooks/useAssincrono'
import { dataHora, mesAtual, mesValido } from '../../utils/datas'
import { TIPO_MOVIMENTO } from '../../utils/rotulos'
import { Carregando, Falha, Indicador, Vazio, Voltar } from '../../components/ui'

export function Extrato() {
  const { alunoId = '' } = useParams()
  const [parametros, setParametros] = useSearchParams()
  const mesInformado = parametros.get('mes') ?? ''
  const mes = mesValido(mesInformado) ? mesInformado : mesAtual()
  const pagina = Math.max(0, Number.parseInt(parametros.get('pagina') ?? '0', 10) || 0)

  const aluno = useAssincrono(async () => (await listarAlunos()).find((a) => a.id === alunoId) ?? null, [alunoId])
  const extrato = useAssincrono(() => listarExtratoDoMes(alunoId, mes, pagina), [alunoId, mes, pagina])

  if (aluno.dados === null) {
    if (aluno.erro) return <Falha mensagem={aluno.erro} tentarDeNovo={aluno.recarregar} />
    if (aluno.carregando) return <Carregando />
    return (
      <div className="narrow-page">
        <Voltar para="/responsavel" />
        <section className="card">
          <Vazio titulo="Aluno não disponível" icone="usuarios">
            O aluno não está vinculado a esta conta.
          </Vazio>
        </section>
      </div>
    )
  }

  const totalPaginas = Math.max(1, Math.ceil((extrato.dados?.totalMovimentos ?? 0) / MOVIMENTOS_POR_PAGINA))

  return (
    <div className="narrow-page">
      <Voltar para="/responsavel" />
      <div className="page-heading">
        <h1>Extrato de {aluno.dados.nome}</h1>
        <p className="muted">Compras, créditos e pagamentos da conta na cantina.</p>
      </div>
      <label className="period-field">
        Mês do extrato
        <input
          type="month"
          value={mes}
          max={mesAtual()}
          onChange={(e) => e.target.value && setParametros({ mes: e.target.value, pagina: '0' })}
        />
      </label>

      {!extrato.dados ? (
        extrato.erro ? (
          <Falha mensagem={extrato.erro} tentarDeNovo={extrato.recarregar} />
        ) : (
          <Carregando />
        )
      ) : (
        <>
          <Indicador rotulo="Total gasto no mês" valor={formatarCentavos(extrato.dados.gastoCentavos)} destaque />
          <section className="card statement-list">
            {extrato.dados.movimentos.length ? (
              extrato.dados.movimentos.map((movimento) => (
                <article className="movement" key={movimento.id}>
                  <div className="movement-heading">
                    <div>
                      <h3>{TIPO_MOVIMENTO[movimento.tipo]}</h3>
                      <small>{dataHora(movimento.criado_em)}</small>
                    </div>
                    <strong className={movimento.valor_centavos > 0 ? 'positive' : ''}>
                      {movimento.valor_centavos > 0 ? '+ ' : ''}
                      {formatarCentavos(movimento.valor_centavos)}
                    </strong>
                  </div>
                  {movimento.itens.map((item, indice) => (
                    <div className="statement-item" key={indice}>
                      <div>
                        <strong>{item.nome_produto}</strong>
                        <small>
                          Qtd. {item.quantidade} · {formatarCentavos(item.preco_unitario_centavos)}
                        </small>
                      </div>
                      <b>{formatarCentavos(item.subtotal_centavos)}</b>
                    </div>
                  ))}
                  {!movimento.itens.length && movimento.descricao && <p className="muted small">{movimento.descricao}</p>}
                </article>
              ))
            ) : (
              <Vazio titulo="Nenhuma movimentação neste mês">Escolha outro mês para consultar o histórico.</Vazio>
            )}
          </section>
          <div className="pagination">
            <button
              type="button"
              className="button secondary"
              disabled={pagina === 0}
              onClick={() => setParametros({ mes, pagina: String(pagina - 1) })}
            >
              Anterior
            </button>
            <span>
              Página {pagina + 1} de {totalPaginas}
              <small>{extrato.dados.totalMovimentos} movimentações</small>
            </span>
            <button
              type="button"
              className="button secondary"
              disabled={pagina + 1 >= totalPaginas}
              onClick={() => setParametros({ mes, pagina: String(pagina + 1) })}
            >
              Próxima
            </button>
          </div>
        </>
      )}

      <Link className="button primary full spaced" to={`/responsavel/alunos/${alunoId}/limites`}>
        Limites e créditos
      </Link>
    </div>
  )
}
