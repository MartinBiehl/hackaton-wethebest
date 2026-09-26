import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useProfile, useQuery, useService } from '../../hooks/portal'
import { Empty, Metric } from '../../components/ui'
import { Back, Failure, Loading, NoStudent } from '../../components/PageState'
import { currentMonth, money, shortDate } from '../../utils/format'
export default function Extrato() {
 const { alunoId = '' } = useParams(), [params, setParams] = useSearchParams(), api = useService(), profile = useProfile()
 const rawMonth = params.get('mes') || currentMonth(), month = /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth) ? rawMonth : currentMonth()
 const page = Math.max(0, Number.parseInt(params.get('pagina') || '0') || 0)
 const studentQuery = useQuery(() => api.getStudent(alunoId), 'extrato-aluno:' + profile.id + ':' + alunoId)
 const query = useQuery(() => api.statement(alunoId, month, page), 'extrato:' + profile.id + ':' + alunoId + ':' + month + ':' + page)
 if (studentQuery.loading) return <Loading/>
 if (studentQuery.error) return <Failure message={studentQuery.error} retry={studentQuery.reload}/>
 if (!studentQuery.data) return <NoStudent/>
 const student = studentQuery.data
 function changePage(next: number) { setParams({ mes: month, pagina: String(next) }) }
 return <div className="narrow-page"><Back to="/responsavel"/><div className="page-heading"><h1>Extrato de {student.nome}</h1><p className="muted">Compras recentes e movimentações da conta.</p></div><label className="period-field">Período do extrato<input aria-label="Mês do extrato" type="month" value={month} onChange={e => { if (e.target.value) setParams({ mes: e.target.value, pagina: '0' }) }}/></label>
 {query.loading ? <Loading/> : query.error ? <Failure message={query.error} retry={query.reload}/> : <><Metric label="TOTAL GASTO NO MÊS SELECIONADO" value={money(query.data!.totalExpense)} accent/><section className="card statement-list">{query.data!.entries.length ? query.data!.entries.map(m => <article className="movement" key={m.id}><div className="movement-heading"><div><h3>{m.tipo === 'compra' ? 'Compra na cantina' : m.tipo === 'estorno' ? 'Estorno' : m.tipo === 'credito' ? 'Crédito adicionado' : m.descricao}</h3><small>{shortDate(m.data)} · {new Date(m.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}</small></div><strong className={m.valor > 0 ? 'positive' : ''}>{m.valor > 0 ? '+ ' : ''}{money(m.valor)}</strong></div>{m.itens.map((i, index) => <div className="statement-item" key={index}><div><strong>{i.nome}</strong><small>Qtd. {i.quantidade} · {money(i.preco)}</small></div><b>{money(i.preco * i.quantidade)}</b></div>)}{!m.itens.length && <p className="muted small">{m.descricao}</p>}</article>) : <Empty title="Nenhuma movimentação neste mês">Selecione outro período para consultar o histórico.</Empty>}</section><div className="pagination"><button className="button secondary" disabled={page === 0} onClick={() => changePage(page - 1)}>Anterior</button><span>Página {page + 1} de {Math.max(1, Math.ceil(query.data!.totalCount / 20))}<small>{query.data!.totalCount} movimentações</small></span><button className="button secondary" disabled={(page + 1) * 20 >= query.data!.totalCount} onClick={() => changePage(page + 1)}>Próxima</button></div></>}
 <Link className="button primary full spaced" to={'/responsavel/alunos/' + alunoId + '/limites'}>Limites e créditos</Link></div>
}
