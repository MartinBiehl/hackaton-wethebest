import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart, useProfile, useQuery, useService } from '../../hooks/portal'
import { Notice, Steps } from '../../components/ui'
import { Back, Failure, Loading, NoStudent } from '../../components/PageState'
import OrderSummary from '../../components/OrderSummary'
import { formatDate, initialDate, intervals, isOpen, schoolDate, totalItems } from '../../utils/format'
import { explain } from '../../services/api'
export default function AgendarPedido() {
 const api = useService(), profile = useProfile(), cart = useCart(), navigate = useNavigate()
 const query = useQuery(() => api.getStudent(), 'retirada:' + profile.id)
 const [date, setDate] = useState(initialDate), [slot, setSlot] = useState(''), [now, setNow] = useState(Date.now()), [error, setError] = useState(''), [busy, setBusy] = useState(false)
 const lock = useRef(false)
 useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer) }, [])
 if (query.loading) return <Loading/>
 if (query.error) return <Failure message={query.error} retry={query.reload}/>
 if (!query.data) return <NoStudent/>
 const student = query.data
 const total = totalItems(cart.items)
 const blocked = student.pendente || student.saldo - total < -25000 || (student.limite !== null && student.gasto + total > student.limite)
 async function confirm() {
  if (lock.current || !api.orders.supported || !slot || !cart.items.length || blocked) return
  if (!isOpen(date, slot)) { setError('Os pedidos deste intervalo já encerraram. Escolha outro horário.'); return }
  lock.current = true; setBusy(true); setError('')
  try {
   const order = await api.orders.confirm({ alunoId: student!.id, data: date, intervalo: slot, itens: cart.items.map(i => ({ produtoId: i.productId, quantidade: i.quantidade })) })
   cart.clear(); navigate('/aluno/pedido/' + encodeURIComponent(order.id) + '/confirmado')
  } catch (e) { setError(explain(e)) } finally { lock.current = false; setBusy(false) }
 }
 return <div className="narrow-page"><Back to="/aluno/pedido">Voltar</Back><h1>Agendar pedido</h1><Steps step={2}/>{!cart.items.length ? <Notice>Seu carrinho está vazio. <Link to="/aluno">Voltar ao cardápio</Link></Notice> : <><section className="card form-stack"><label>Data da retirada<input type="date" min={schoolDate()} value={date} onChange={e => { setDate(e.target.value); setSlot('') }}/></label><fieldset className="slot-fields"><legend>Escolha o intervalo de retirada</legend>{intervals.map(i => <label className={'slot ' + (slot === i.id ? 'selected ' : '') + (!isOpen(date, i.id, now) ? 'disabled' : '')} key={i.id}><input type="radio" name="intervalo" checked={slot === i.id} disabled={!isOpen(date, i.id, now)} onChange={() => setSlot(i.id)}/><span><strong>{i.label}</strong><small>{i.time}{!isOpen(date, i.id, now) ? ' · Encerrado' : ''}</small></span></label>)}</fieldset><Notice>Os pedidos fecham 15 minutos antes do intervalo. A retirada será identificada no balcão.</Notice></section><OrderSummary items={cart.items}/>{date && slot && <div className="selected-pickup"><span>RETIRADA SELECIONADA</span><strong>{formatDate(date)} · {intervals.find(i => i.id === slot)?.label}</strong></div>}{!api.orders.supported && <Notice>O agendamento ainda não está disponível. Você pode montar seu pedido, mas ele não será enviado à cantina.</Notice>}{blocked && <Notice tone="error">O pedido não pode ser confirmado. Confira o saldo, o limite mensal ou a aprovação da sua conta.</Notice>}{error && <Notice tone="error">{error}</Notice>}<button className="button primary full" disabled={!api.orders.supported || !slot || !isOpen(date, slot, now) || blocked || busy} onClick={() => void confirm()}>{busy ? 'Confirmando…' : 'Confirmar pedido'}</button></>}</div>
}
