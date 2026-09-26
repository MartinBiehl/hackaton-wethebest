import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCart, useProfile, useQuery, useService } from '../../hooks/portal'
import Icon from '../../components/Icon'
import { Empty, Metric, Notice } from '../../components/ui'
import { Failure, Loading, NoStudent } from '../../components/PageState'
import OrderSummary from '../../components/OrderSummary'
import { filterProducts, money } from '../../utils/format'
import type { Product } from '../../types'

export default function Cardapio() {
 const api = useService(), profile = useProfile(), cart = useCart()
 const query = useQuery(async () => ({ student: await api.getStudent(), products: await api.listProducts() }), 'catalogo:' + profile.id)
 const [search, setSearch] = useState(''), [category, setCategory] = useState('Todos'), [message, setMessage] = useState('')
 if (query.loading) return <Loading/>
 if (query.error) return <Failure message={query.error} retry={query.reload}/>
 if (!query.data?.student) return <NoStudent/>
 const { student, products } = query.data
 if (student.pendente) return <Notice>A conta do aluno aguarda aprovação do responsável.</Notice>
 const categories = ['Todos', ...new Set(products.map(p => p.categoria))]
 const filtered = filterProducts(products, search, category)
 function add(product: Product) {
  const exists = cart.items.find(i => i.productId === product.id)
  if ((exists?.quantidade || 0) >= 99) { setMessage('O limite por produto no carrinho é de 99 unidades.'); return }
  cart.setItems(exists ? cart.items.map(i => i.productId === product.id ? { ...i, preco: product.preco, quantidade: i.quantidade + 1 } : i) : [...cart.items, { productId: product.id, nome: product.nome, preco: product.preco, quantidade: 1 }])
  setMessage(product.nome + ' adicionado ao pedido.')
 }
 return <><section className="welcome-row"><h1>Olá, {profile.nome.split(' ')[0]}!</h1><div className="balance-pair"><Metric label="Saldo disponível" value={money(student.saldo)} accent/><Metric label="Limite mensal" value={student.limite === null ? 'Sem limite' : money(student.limite)}/></div></section>
 <div className="catalog-layout"><section><h2 className="section-title">Comprar na cantina</h2><label className="search-field"><Icon name="search" size={19}/><input type="search" aria-label="Pesquisar item" placeholder="Pesquisar item…" value={search} onChange={e => setSearch(e.target.value)}/></label><div className="categories" aria-label="Categorias">{categories.map(c => <button key={c} aria-pressed={c === category} className={c === category ? 'active' : ''} onClick={() => setCategory(c)}>{c}</button>)}</div>
 <p className="cart-feedback" role="status">{message || '\u00a0'}</p>
 {filtered.length ? <div className="products">{filtered.map(p => <article className="product-card" key={p.id}><div className="product-heading"><span className="product-icon"><Icon name={p.icon} size={23}/></span><div><h3>{p.nome}</h3><p>{p.categoria}</p></div></div><div className="product-bottom"><strong>{money(p.preco)}</strong><button className="button primary add-button" disabled={p.disponibilidade === 'indisponivel'} onClick={() => add(p)} aria-label={'Adicionar ' + p.nome}>{p.disponibilidade === 'indisponivel' ? 'Esgotado' : <><Icon name="plus" size={15}/>Adicionar</>}</button></div></article>)}</div> : <Empty title="Nenhum item encontrado" icon="search">Tente outro nome ou categoria.</Empty>}
 {products.some(p => p.disponibilidade === 'desconhecida') && <p className="fine-print left">A disponibilidade para retirada ainda precisa ser confirmada pela cantina.</p>}</section>
 <aside className="cart-aside">{cart.items.length ? <OrderSummary items={cart.items}><Link className="button primary full" to="/aluno/pedido">Continuar</Link></OrderSummary> : <section className="card"><Empty title="Meu pedido" icon="bag">Adicione produtos para montar seu lanche.</Empty></section>}</aside></div></>
}
