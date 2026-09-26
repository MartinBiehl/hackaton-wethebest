import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useSessao } from './hooks/useSessao'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Vendas } from './pages/Vendas'
import { NovaVenda } from './pages/NovaVenda'
import { FechamentoMensal } from './pages/FechamentoMensal'
import { Pedidos } from './pages/Pedidos'
import { Pagamentos } from './pages/Pagamentos'
import { Produtos } from './pages/Produtos'
import { Alunos } from './pages/Alunos'
import { Intervalos } from './pages/Intervalos'

export default function App() {
  const { carregando, perfil } = useSessao()

  if (carregando) return <div className="tela-cheia">Carregando...</div>
  if (!perfil) return <Login />

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout perfil={perfil} />}>
          <Route path="/vendas" element={<Vendas />} />
          <Route path="/nova-venda" element={<NovaVenda />} />
          <Route path="/fechamento" element={<FechamentoMensal />} />
          <Route path="/pedidos" element={<Pedidos />} />
          <Route path="/pagamentos" element={<Pagamentos />} />
          <Route path="/produtos" element={<Produtos />} />
          <Route path="/alunos" element={<Alunos />} />
          <Route path="/intervalos" element={<Intervalos />} />
          <Route path="*" element={<Navigate to="/vendas" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
