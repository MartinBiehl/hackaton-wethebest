import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useProfile, useQuery, useService } from '../../hooks/portal'
import { Metric, Modal, Notice } from '../../components/ui'
import { Back, Failure, Loading, NoStudent } from '../../components/PageState'
import { money, parseMoney } from '../../utils/format'
import { explain } from '../../services/api'
export default function LimitesCreditos() {
 const { alunoId = '' } = useParams(), api = useService(), profile = useProfile()
 const query = useQuery(() => api.getStudent(alunoId), 'limites:' + profile.id + ':' + alunoId)
 const [limit, setLimit] = useState(''), [unlimited, setUnlimited] = useState(false), [credit, setCredit] = useState(''), [confirmation, setConfirmation] = useState<number | null>(null)
 const [error, setError] = useState(''), [success, setSuccess] = useState(''), [busy, setBusy] = useState(false)
 const lock = useRef(false)
 useEffect(() => { if (query.data) { setLimit(query.data.limite === null ? '' : (query.data.limite / 100).toFixed(2).replace('.', ',')); setUnlimited(query.data.limite === null) } }, [query.data])
 async function save(kind: 'limit' | 'credit', value: number | null) {
  if (lock.current) return
  lock.current = true; setBusy(true); setError(''); setSuccess('')
  try {
   if (kind === 'limit') await api.setLimit(alunoId, value)
   else await api.addCredit(alunoId, value!)
   setSuccess(kind === 'limit' ? 'Limite mensal atualizado.' : 'Crédito registrado com sucesso.')
   if (kind === 'credit') { setCredit(''); setConfirmation(null) }
   query.reload()
  } catch (e) { setError(explain(e)) } finally { lock.current = false; setBusy(false) }
 }
 function limitSubmit(e: FormEvent) {
  e.preventDefault(); setError('')
  const value = unlimited ? null : parseMoney(limit)
  if (!unlimited && value === null) { setError('Informe um limite válido, com até duas casas decimais.'); return }
  void save('limit', value)
 }
 function creditSubmit(e: FormEvent) {
  e.preventDefault();setError(''); const value = parseMoney(credit)
  if (value === null || value <= 0) { setError('Informe um crédito maior que zero, com até duas casas decimais.'); return }
  setConfirmation(value)
 }
 if (query.loading) return <Loading/>
 if (query.error) return <><Failure message={query.error} retry={query.reload}/>{success && <Notice tone="success">{success} Não foi possível atualizar os valores exibidos; tente novamente.</Notice>}</>
 if (!query.data) return <NoStudent/>
 const student = query.data
 return <div className="narrow-page"><Back to="/responsavel"/><div className="page-heading"><h1>{student.nome}</h1>{student.turma && <p className="muted">{student.turma}</p>}</div><div className="limits-metrics"><Metric label="Saldo disponível" value={money(student.saldo)} accent/><Metric label="Limite mensal" value={student.limite === null ? 'Sem limite' : money(student.limite)}/><Metric label="Gasto no mês" value={money(student.gasto)} accent/></div>{success && <div role="status"><Notice tone="success">{success}</Notice></div>}{error && <Notice tone="error">{error}</Notice>}<section className="card settings-card"><h2>Configurações de consumo</h2><form className="form-stack" onSubmit={limitSubmit}><label>Alterar limite mensal<div className="money-field"><span>R$</span><input aria-label="Novo limite mensal" inputMode="decimal" value={limit} disabled={unlimited || busy} onChange={e => setLimit(e.target.value)} placeholder="250,00" required={!unlimited}/></div></label><label className="checkbox-label"><input type="checkbox" checked={unlimited} disabled={busy} onChange={e => setUnlimited(e.target.checked)}/>Sem limite mensal</label><button className="button primary full" disabled={busy}>Salvar limite</button><small>O limite mensal impede compras acima do valor definido no mesmo mês. O teto de fiado de R$ 250,00 continua valendo.</small></form><form className="form-stack credit-form" onSubmit={creditSubmit}><label>Adicionar crédito<div className="money-field"><span>R$</span><input aria-label="Valor do crédito" inputMode="decimal" value={credit} onChange={e => setCredit(e.target.value)} placeholder="Digite o valor (ex.: 50,00)" disabled={busy} required/></div></label><button className="button primary full" disabled={busy}>Adicionar crédito</button><small>O valor será registrado no saldo do aluno. Este portal não realiza cobrança por Pix ou cartão.</small></form><Link className="button secondary full" to={'/responsavel/alunos/' + alunoId + '/extrato'}>Ver extrato completo</Link></section>
 {confirmation !== null && <Modal title="Confirmar crédito" onClose={() => { if (!busy) setConfirmation(null) }}><p>Adicionar <strong>{money(confirmation)}</strong> à conta de {student.nome}?</p><Notice>Confirme somente um crédito autorizado. Esta ação registra o valor no extrato, sem cobrar um pagamento.</Notice>{error && <Notice tone="error">{error}</Notice>}<div className="button-row"><button className="button secondary" disabled={busy} onClick={() => setConfirmation(null)}>Voltar</button><button className="button primary" disabled={busy} onClick={() => void save('credit', confirmation)}>{busy ? 'Registrando…' : 'Confirmar crédito'}</button></div></Modal>}</div>
}
