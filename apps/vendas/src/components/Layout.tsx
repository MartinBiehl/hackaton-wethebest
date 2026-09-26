import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { sair, type Perfil } from '../services/auth'
import { LimiteDeErro } from './LimiteDeErro'

const LINKS = [
  { para: '/vendas', rotulo: 'Vendas' },
  { para: '/nova-venda', rotulo: 'Nova venda' },
  { para: '/pedidos', rotulo: 'Pedidos' },
  { para: '/pagamentos', rotulo: 'Pagamentos' },
  { para: '/produtos', rotulo: 'Produtos' },
  { para: '/alunos', rotulo: 'Alunos' },
  { para: '/intervalos', rotulo: 'Intervalos' },
]

export function Layout({ perfil }: { perfil: Perfil }) {
  const { pathname } = useLocation()

  return (
    <>
      <header className="cabecalho">
        <div className="cabecalho-conteudo">
          <NavLink to="/vendas" className="marca">
            iCarla
          </NavLink>
          <nav className="navegacao" aria-label="Principal">
            {LINKS.map((link) => (
              <NavLink key={link.para} to={link.para}>
                {link.rotulo}
              </NavLink>
            ))}
          </nav>
          <div className="usuario">
            <span>{perfil.nome.split(' ')[0]}</span>
            <button type="button" onClick={() => sair()}>
              Sair
            </button>
          </div>
        </div>
      </header>
      {/* A chave recria o limite a cada tela: um erro não "gruda" ao navegar. */}
      <LimiteDeErro key={pathname}>
        <Outlet />
      </LimiteDeErro>
    </>
  )
}
