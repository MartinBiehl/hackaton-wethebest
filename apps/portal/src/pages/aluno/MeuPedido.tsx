import { Link } from 'react-router-dom'
import { useCart, useProfile, useQuery, useService } from '../../hooks/portal'
import Icon from '../../components/Icon'
import { Empty, Notice, Steps } from '../../components/ui'
import { Back, Failure, Loading, NoStudent } from '../../components/PageState'
import OrderSummary from '../../components/OrderSummary'
import { money, totalItems } from '../../utils/format'
export default function MeuPedido() {
 const cart = useCart(), api = useService(), profile = useProfile()
 const query = useQuery(() => api.getStudent(), 'pedido:' + profile.id)
 if (query.loading) return <Loading/>
 if (query.error) return <Failure message={query.error} retry={query.reload}/>
 if (!query.data) return <NoStudent/>
 const student = query.data, total = totalItems(cart.items)
 const problem = student.pendente ? 'Sua conta aguarda aprovação.' : student.saldo - total < -25000 ? 'O pedido ultrapassa o limite de fiado de R$ 250,00.' : student.limite !== null && student.gasto + total > student.limite ? 'O pedido ultrapassa o limite mensal definido pelo responsável.' : ''
 function change(id: string, count: number) { cart.setItems(count <= 0 ? cart.items.filter(i => i.productId !== id) : cart.items.map(i => i.productId === id ? { ...i, quantidade: Math.min(99, count) } : i)) }
 return <div className="narrow-page"><Back to="/aluno">Voltar</Back><h1>Meu pedido</h1><Steps step={1}/>{cart.items.length ? <><section className="card cart-items"><div className="cart-table-head"><span>Produto</span><span>Qtd</span><span>Un.</span><span>Total</span><span/></div>{cart.items.map(i => <div className="cart-item" key={i.productId}><h3>{i.nome}</h3><div className="quantity"><button onClick={() => change(i.productId, i.quantidade - 1)} aria-label={'Diminuir ' + i.nome}><Icon name="minus" size={14}/></button><span>{i.quantidade}</span><button onClick={() => change(i.productId, i.quantidade + 1)} disabled={i.quantidade >= 99} aria-label={'Aumentar ' + i.nome}><Icon name="plus" size={14}/></button></div><span className="unit-price">{money(i.preco)}</span><strong>{money(i.preco * i.quantidade)}</strong><button className="icon-button danger" aria-label={'Remover ' + i.nome} onClick={() => change(i.productId, 0)}><Icon name="trash" size={17}/></button></div>)}<div className="cart-balance"><span className="circle-icon"><Icon name="wallet" size={19}/></span><div><strong>Seu saldo após este pedido</strong><p>{money(student.saldo - total)} <span>previstos</span></p></div></div></section><OrderSummary items={cart.items}/>{problem && <Notice tone="error">{problem}</Notice>}{problem ? <button className="button primary full" disabled>Agendar pedido</button> : <Link className="button primary full" to="/aluno/retirada">Agendar pedido</Link>}<Link className="text-link centered" to="/aluno">Adicionar mais produtos</Link></> : <section className="card"><Empty title="Seu pedido está vazio" icon="bag">Escolha seus produtos no cardápio.</Empty><Link className="button primary full" to="/aluno">Ver cardápio</Link></section>}</div>
}
