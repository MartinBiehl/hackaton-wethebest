import { Link } from 'react-router-dom'
import { formatarCentavos } from '@wethebest/shared'
import { listarPedidos } from '../../services/pedidos'
import { useAssincrono } from '../../hooks/useAssincrono'
import { dataCurta } from '../../utils/datas'
import { STATUS_PEDIDO } from '../../utils/rotulos'
import { Carregando, Falha, Vazio } from '../../components/ui'

export function MeusPedidos() {
  const { dados: pedidos, erro, recarregar } = useAssincrono(() => listarPedidos(30), [], 5000)

  return (
    <div className="narrow-page">
      <div className="page-heading">
        <h1>Meus pedidos</h1>
        <p className="muted">Pedidos feitos pelo portal para retirar no intervalo.</p>
      </div>
      {!pedidos ? (
        erro ? (
          <Falha mensagem={erro} tentarDeNovo={recarregar} />
        ) : (
          <Carregando />
        )
      ) : pedidos.length === 0 ? (
        <section className="card">
          <Vazio titulo="Nenhum pedido ainda" icone="sacola">
            Monte seu lanche no cardápio e agende a retirada.
          </Vazio>
          <Link className="button primary full" to="/aluno">
            Ver cardápio
          </Link>
        </section>
      ) : (
        <section className="card recent-list">
          {pedidos.map((pedido) => (
            <Link className="recent-row" key={pedido.id} to={`/aluno/pedidos/${pedido.id}`}>
              <span className="recent-date">{dataCurta(pedido.data_retirada)}</span>
              <span>
                <strong>{pedido.intervalo ?? 'Retirada'}</strong>
                <small>{pedido.itens.map((item) => `${item.quantidade}× ${item.nome_produto}`).join(' + ')}</small>
                <span className={`status-pill ${pedido.status}`}>{STATUS_PEDIDO[pedido.status]}</span>
              </span>
              <b>{formatarCentavos(pedido.total_centavos)}</b>
            </Link>
          ))}
        </section>
      )}
    </div>
  )
}
