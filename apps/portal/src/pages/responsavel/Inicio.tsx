import { Link } from 'react-router-dom'
import { useProfile, useQuery, useService } from '../../hooks/portal'
import { Empty, Metric, Notice } from '../../components/ui'
import { Failure, Loading } from '../../components/PageState'
import { money, shortDate, schoolDate } from '../../utils/format'
export default function Inicio() {
 const api = useService(), profile = useProfile()
 const query = useQuery(async () => ({ students: await api.listStudents(), purchases: await api.recentPurchases() }), 'familia:' + profile.id)
 if (query.loading) return <Loading/>
 if (query.error) return <Failure message={query.error} retry={query.reload}/>
 const { students, purchases } = query.data!
 return <><div className="page-heading"><h1>Olá, {profile.nome.split(' ')[0]}!</h1><p className="muted">Acompanhe o consumo e os créditos dos seus filhos na cantina.</p></div><div className="metrics-three"><Metric label="Gasto total da família neste mês" value={money(students.reduce((n, s) => n + s.gasto, 0))} accent/><Metric label="Crédito disponível" value={money(students.reduce((n, s) => n + Math.max(s.saldo, 0), 0))} accent/><Metric label="Alunos vinculados" value={String(students.length)}/></div><Notice>Limite de saldo devedor até R$ 250,00 por aluno. Evite interrupções efetuando recargas regulares.</Notice>
 <div className="family-layout"><section><h2 className="section-title">Seus filhos</h2>{students.length ? <div className="children-grid">{students.map(s => <article className="card child-card" key={s.id}><h3>{s.nome}</h3>{s.turma && <p className="muted small">{s.turma}</p>}<div className="child-details"><p><span>{s.saldo < 0 ? 'Saldo devedor: ' : 'Saldo disponível: '}</span><strong className={s.saldo < 0 ? 'negative' : 'blue'}>{money(s.saldo)}</strong></p><p><span>Limite mensal: </span><strong>{s.limite === null ? 'Sem limite' : money(s.limite)}</strong></p></div>{s.pendente && <p className="pending-note">Conta do aluno aguardando aprovação.</p>}<Link className="button primary full" to={'/responsavel/alunos/' + s.id + '/extrato'}>Ver extrato</Link></article>)}</div> : <section className="card"><Empty title="Nenhum aluno vinculado" icon="users">Conclua o vínculo pelo cadastro do projeto para acompanhar sua família.</Empty></section>}</section>
 <aside><h2 className="section-title">Últimas compras</h2><section className="card recent-list">{purchases.length ? purchases.map(p => <Link className="recent-row" key={p.id} to={'/responsavel/alunos/' + p.alunoId + '/extrato?mes=' + schoolDate(new Date(p.data)).slice(0, 7)}><span className="recent-date">{shortDate(p.data)}</span><span><strong>{students.find(s => s.id === p.alunoId)?.nome.split(' ')[0] || 'Aluno'}</strong><small>{p.itens.map(i => i.nome).join(' + ') || p.descricao}</small></span><b>{money(-p.valor)}</b></Link>) : <Empty title="Ainda sem compras">As compras registradas aparecerão aqui.</Empty>}</section></aside></div></>
}
