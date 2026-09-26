import { Outlet, useLocation } from 'react-router-dom'
import { listarAlunos } from '../../services/alunos'
import { useAssincrono } from '../../hooks/useAssincrono'
import type { ContextoAluno } from '../../hooks/useAluno'
import { Aviso, Carregando, Falha, Vazio } from '../../components/ui'
import { VincularConta } from './VincularConta'

// Porta de entrada do aluno: sem registro, liga a conta ao pré-cadastro do
// responsável; com a conta pendente, espera a aprovação. O registro é
// recarregado a cada tela para saldo e limite ficarem atualizados.
export function AreaAluno() {
  const { pathname } = useLocation()
  const { dados, erro, carregando, recarregar } = useAssincrono(listarAlunos, [pathname])

  if (!dados) return erro ? <Falha mensagem={erro} tentarDeNovo={recarregar} /> : <Carregando />

  const aluno = dados[0]
  if (!aluno) return <VincularConta aoConcluir={recarregar} />

  if (aluno.situacao_conta !== 'ativa') {
    return (
      <div className="narrow-page">
        <section className="card">
          <Vazio titulo="Conta aguardando aprovação" icone="usuarios">
            Seu responsável precisa aprovar esta conta no portal. Depois disso você já pode fazer pedidos.
          </Vazio>
          {erro && <Aviso tom="erro">{erro}</Aviso>}
          <button type="button" className="button secondary full" onClick={recarregar} disabled={carregando}>
            {carregando ? 'Verificando…' : 'Verificar novamente'}
          </button>
        </section>
      </div>
    )
  }

  const contexto: ContextoAluno = { aluno, recarregarAluno: recarregar }
  return <Outlet context={contexto} />
}
