import { useEffect, useRef } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { sair } from '../services/auth'
import type { PerfilPortal } from '../hooks/useSessao'
import { Icone } from './Icone'
import { LimiteDeErro } from './LimiteDeErro'

const LINKS = {
  aluno: [
    { para: '/aluno', rotulo: 'Cardápio', fim: true },
    { para: '/aluno/pedidos', rotulo: 'Meus pedidos', fim: false },
    { para: '/aluno/creditos', rotulo: 'Créditos', fim: true },
  ],
  responsavel: [{ para: '/responsavel', rotulo: 'Início', fim: true }],
}

function iniciais(nome: string): string {
  return nome
    .split(' ')
    .filter(Boolean)
    .map((parte) => parte[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function Layout({ perfil }: { perfil: PerfilPortal }) {
  const { pathname } = useLocation()
  const principal = useRef<HTMLElement>(null)
  const inicio = perfil.papel === 'aluno' ? '/aluno' : '/responsavel'

  // Ao trocar de tela, leitores de tela e teclado começam pelo conteúdo novo.
  useEffect(() => {
    window.scrollTo(0, 0)
    principal.current?.focus({ preventScroll: true })
  }, [pathname])

  return (
    <>
      <a
        className="skip-link"
        href="#conteudo"
        onClick={(evento) => {
          evento.preventDefault()
          principal.current?.focus()
        }}
      >
        Pular para o conteúdo
      </a>
      <header className="header">
        <div className="header-inner">
          <Link to={inicio} className="brand" aria-label="iCarla, início">
            <span className="brand-mark">iC</span>
            <span>iCarla</span>
          </Link>
          <div className="header-account">
            <span>{perfil.nome}</span>
            <span className="avatar" aria-hidden="true">
              {iniciais(perfil.nome)}
            </span>
            <button type="button" className="logout-button" onClick={() => sair()} aria-label="Sair">
              <Icone nome="sair" tamanho={18} />
              <span>Sair</span>
            </button>
          </div>
        </div>
        {LINKS[perfil.papel].length > 1 && (
          <nav className="nav" aria-label="Principal">
            {LINKS[perfil.papel].map((link) => (
              <NavLink key={link.para} to={link.para} end={link.fim}>
                {link.rotulo}
              </NavLink>
            ))}
          </nav>
        )}
      </header>
      <main id="conteudo" ref={principal} tabIndex={-1} className="main-content">
        {/* Um erro não "gruda" ao navegar: a nova rota limpa o aviso. */}
        <LimiteDeErro chave={pathname}>
          <Outlet />
        </LimiteDeErro>
      </main>
    </>
  )
}
