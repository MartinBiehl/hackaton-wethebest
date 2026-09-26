import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Icon from './Icon'
import { Empty, Notice } from './ui'
export function Loading() { return <p className="loading" role="status">Carregando informações…</p> }
export function Failure({ message, retry }: { message: string; retry?: () => void }) { return <div className="failure"><Notice tone="error">{message}</Notice>{retry && <button className="button secondary" onClick={retry}>Tentar novamente</button>}</div> }
export function Back({ to, children = 'Voltar para o início' }: { to: string; children?: ReactNode }) { return <Link to={to} className="back-link"><Icon name="arrow" size={15}/>{children}</Link> }
export function NoStudent() { return <section className="card"><Empty title="Aluno não disponível" icon="users">O aluno pode estar aguardando vínculo ou não estar autorizado para esta conta.</Empty></section> }
