import { useEffect, useRef } from 'react'
import { HashRouter, Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import type { PortalService } from './types'
import { portalService } from './services/api'
import { CartProvider, ProfileContext, ServiceContext, useQuery, useProfile } from './hooks/portal'
import { Empty, Notice } from './components/ui'
import { Failure, Loading } from './components/PageState'
import Cardapio from './pages/aluno/Cardapio'
import MeuPedido from './pages/aluno/MeuPedido'
import AgendarPedido from './pages/aluno/AgendarPedido'
import PedidoConfirmado from './pages/aluno/PedidoConfirmado'
import Inicio from './pages/responsavel/Inicio'
import Extrato from './pages/responsavel/Extrato'
import LimitesCreditos from './pages/responsavel/LimitesCreditos'

function Layout() {
 const profile = useProfile(), location = useLocation(), main = useRef<HTMLElement>(null)
 useEffect(() => { window.scrollTo(0, 0); main.current?.focus({ preventScroll: true }) }, [location.pathname])
 const home = profile.papel === 'aluno' ? '/aluno' : '/responsavel'
 return <><a className="skip-link" href="#conteudo" onClick={e => { e.preventDefault(); main.current?.focus() }}>Pular para o conteúdo</a><header className="header"><div className="header-inner"><Link to={home} className="brand" aria-label="iCarla, início"><span className="brand-mark">iC</span><span>iCarla</span></Link><div className="header-account"><span>{profile.nome}</span><span className="avatar">{profile.nome.split(' ').filter(Boolean).map(n => n[0]).slice(0, 2).join('')}</span></div></div></header><main id="conteudo" ref={main} tabIndex={-1} className="main-content"><Outlet/></main></>
}
function Guard({ role }: { role: 'aluno' | 'responsavel' }) { const profile = useProfile(); return profile.papel === role ? <Outlet/> : <Navigate replace to={profile.papel === 'aluno' ? '/aluno' : '/responsavel'}/> }
function Portal({ service }: { service: PortalService }) {
 const session = useQuery(() => service.configured ? service.getProfile() : Promise.resolve(null), 'session')
 useEffect(() => service.onSessionChange(session.reload), [service, session.reload])
 if (session.loading) return <div className="access-state"><Loading/></div>
 if (session.error) return <div className="access-state"><h1>iCarla</h1><Failure message={session.error} retry={session.reload}/></div>
 if (!session.data) return <div className="access-state"><span className="brand-mark">iC</span><h1>iCarla</h1><section className="card"><Empty title="Acesso necessário" icon="user">Entre pela autenticação do projeto para acessar o portal de aluno ou responsável.</Empty>{!service.configured && <Notice>O acesso aos dados ainda não foi configurado neste ambiente.</Notice>}<button className="button primary full" onClick={session.reload}>Verificar minha sessão</button></section></div>
 const profile = session.data
 return <ProfileContext.Provider value={profile}><CartProvider key={profile.id} userId={profile.id}><Routes><Route element={<Layout/>}><Route element={<Guard role="aluno"/>}><Route path="/aluno" element={<Cardapio/>}/><Route path="/aluno/pedido" element={<MeuPedido/>}/><Route path="/aluno/retirada" element={<AgendarPedido/>}/><Route path="/aluno/pedido/:pedidoId/confirmado" element={<PedidoConfirmado/>}/></Route><Route element={<Guard role="responsavel"/>}><Route path="/responsavel" element={<Inicio/>}/><Route path="/responsavel/alunos/:alunoId/extrato" element={<Extrato/>}/><Route path="/responsavel/alunos/:alunoId/limites" element={<LimitesCreditos/>}/></Route><Route path="*" element={<Navigate replace to={profile.papel === 'aluno' ? '/aluno' : '/responsavel'}/>}/></Route></Routes></CartProvider></ProfileContext.Provider>
}
export default function App({ service = portalService }: { service?: PortalService }) { return <ServiceContext.Provider value={service}><HashRouter><Portal service={service}/></HashRouter></ServiceContext.Provider> }
