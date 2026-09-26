import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useSessao, type PerfilPortal } from './hooks/useSessao'
import { Layout } from './components/Layout'
import { ProvedorCarrinho } from './components/ProvedorCarrinho'
import { Carregando } from './components/ui'
import { Entrar } from './pages/Entrar'
import { Cadastro } from './pages/Cadastro'
import { AreaAluno } from './pages/aluno/AreaAluno'
import { Cardapio } from './pages/aluno/Cardapio'
import { MeuPedido } from './pages/aluno/MeuPedido'
import { AgendarPedido } from './pages/aluno/AgendarPedido'
import { MeusPedidos } from './pages/aluno/MeusPedidos'
import { PedidoDetalhe } from './pages/aluno/PedidoDetalhe'
import { Creditos } from './pages/aluno/Creditos'
import { Inicio } from './pages/responsavel/Inicio'
import { Extrato } from './pages/responsavel/Extrato'
import { LimitesCreditos } from './pages/responsavel/LimitesCreditos'

function RotasAluno({ perfil }: { perfil: PerfilPortal }) {
  return (
    // A chave descarta o carrinho de outra conta que tenha usado esta aba.
    <ProvedorCarrinho key={perfil.id} usuarioId={perfil.id}>
      <Routes>
        <Route element={<Layout perfil={perfil} />}>
          <Route path="/aluno" element={<AreaAluno />}>
            <Route index element={<Cardapio />} />
            <Route path="pedido" element={<MeuPedido />} />
            <Route path="retirada" element={<AgendarPedido />} />
            <Route path="pedidos" element={<MeusPedidos />} />
            <Route path="pedidos/:pedidoId" element={<PedidoDetalhe />} />
            <Route path="creditos" element={<Creditos />} />
          </Route>
          <Route path="*" element={<Navigate to="/aluno" replace />} />
        </Route>
      </Routes>
    </ProvedorCarrinho>
  )
}

function RotasResponsavel({ perfil }: { perfil: PerfilPortal }) {
  return (
    <Routes>
      <Route element={<Layout perfil={perfil} />}>
        <Route path="/responsavel" element={<Inicio perfil={perfil} />} />
        <Route path="/responsavel/alunos/:alunoId/extrato" element={<Extrato />} />
        <Route path="/responsavel/alunos/:alunoId/limites" element={<LimitesCreditos />} />
        <Route path="*" element={<Navigate to="/responsavel" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  const { carregando, perfil } = useSessao()

  if (carregando) {
    return (
      <div className="access-state">
        <Carregando />
      </div>
    )
  }

  return (
    <BrowserRouter>
      {!perfil ? (
        <Routes>
          <Route path="/cadastro" element={<Cadastro />} />
          <Route path="*" element={<Entrar />} />
        </Routes>
      ) : perfil.papel === 'aluno' ? (
        <RotasAluno perfil={perfil} />
      ) : (
        <RotasResponsavel perfil={perfil} />
      )}
    </BrowserRouter>
  )
}
