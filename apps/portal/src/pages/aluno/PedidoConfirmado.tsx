import { Link, useParams } from 'react-router-dom'
import { useProfile, useQuery, useService } from '../../hooks/portal'
import { Empty, Steps } from '../../components/ui'
import { Failure, Loading } from '../../components/PageState'
import Icon from '../../components/Icon'
import OrderSummary from '../../components/OrderSummary'
import { formatDate, intervals } from '../../utils/format'
export default function PedidoConfirmado() {
 const api = useService(), profile = useProfile(), { pedidoId = '' } = useParams()
 const query = useQuery(async () => {
  if (!api.orders.supported) return null
  const [order, student] = await Promise.all([api.orders.get(pedidoId), api.getStudent()])
  return order && student && order.alunoId === student.id ? order : null
 }, 'confirmacao:' + profile.id + ':' + pedidoId)
 if (query.loading) return <Loading/>
 if (query.error) return <Failure message={query.error} retry={query.reload}/>
 if (!query.data) return <div className="narrow-page"><section className="card"><Empty title="Nenhum pedido confirmado" icon="bag">Uma confirmação só aparece após o pedido ser recebido pela cantina.</Empty><Link className="button primary full" to="/aluno">Voltar para início</Link></section></div>
 const order = query.data, slot = intervals.find(i => i.id === order.intervalo)
 return <div className="narrow-page"><Steps step={3}/><section className="card confirmation"><div className="success-circle"><Icon name="check" size={31}/></div><h1>Pedido agendado!</h1><p className="muted">Seu pedido foi confirmado e estará esperando por você na cantina.</p><div className="pickup-card"><Icon name="calendar" size={22}/><div><span>RETIRADA</span><strong>{formatDate(order.data)}</strong><small>{slot ? slot.label + ' · ' + slot.time : order.intervalo}</small></div></div>{order.codigoRetirada && <div className="pickup-code"><span>Código de retirada</span><strong>{order.codigoRetirada}</strong></div>}<OrderSummary items={order.itens}/><Link className="button primary full" to="/aluno">Voltar para início</Link></section></div>
}
