import type { ReactNode } from 'react'
import type { Item } from '../types'
import { money, totalItems, units } from '../utils/format'
export default function OrderSummary({ items, children }: { items: Item[]; children?: ReactNode }) {
 const count = units(items)
 return <section className="card order-summary" aria-label="Resumo do pedido"><div className="section-heading"><h2>Resumo do pedido</h2><span className="badge">{count} {count === 1 ? 'unidade' : 'unidades'}</span></div><div className="summary-lines">{items.map(i => <div key={i.productId}><span>{i.quantidade}× {i.nome}</span><strong>{money(i.preco * i.quantidade)}</strong></div>)}</div><div className="summary-total"><strong>Total</strong><strong>{money(totalItems(items))}</strong></div>{children}</section>
}
