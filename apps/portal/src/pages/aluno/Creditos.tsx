import { formatarCentavos } from '@wethebest/shared'
import { useAluno } from '../../hooks/useAluno'
import { ComprarCredito } from '../../components/ComprarCredito'
import { Indicador } from '../../components/ui'

export function Creditos() {
  const { aluno, recarregarAluno } = useAluno()

  return (
    <div className="narrow-page">
      <div className="page-heading">
        <h1>Créditos</h1>
        <p className="muted">Compre créditos para pagar seus pedidos com o saldo da conta.</p>
      </div>
      <div className="limits-metrics">
        <Indicador rotulo="Saldo disponível" valor={formatarCentavos(aluno.saldo_centavos)} destaque />
        <Indicador rotulo="Gasto no mês" valor={formatarCentavos(aluno.gasto_mes_centavos)} />
        <Indicador
          rotulo="Limite mensal"
          valor={aluno.limite_mensal_centavos === null ? 'Sem limite' : formatarCentavos(aluno.limite_mensal_centavos)}
        />
      </div>
      <section className="card settings-card">
        <ComprarCredito alunoId={aluno.id} nomeAluno="a sua conta" aoSolicitar={recarregarAluno} />
      </section>
    </div>
  )
}
