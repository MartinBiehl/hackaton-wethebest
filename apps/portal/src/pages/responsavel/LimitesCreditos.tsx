import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { formatarCentavos, reaisParaCentavos } from '@wethebest/shared'
import { definirLimiteMensal, listarAlunos } from '../../services/alunos'
import { useAssincrono } from '../../hooks/useAssincrono'
import { mensagemDeErro } from '../../utils/erro'
import { ComprarCredito } from '../../components/ComprarCredito'
import { Aviso, Carregando, Falha, Indicador, Vazio, Voltar } from '../../components/ui'

function paraReais(centavos: number): string {
  return (centavos / 100).toFixed(2).replace('.', ',')
}

type Mensagem = { tom: 'sucesso' | 'erro'; texto: string }

type PropsFormulario = {
  alunoId: string
  limiteAtual: number | null
  aoSalvar: () => void
}

// Começa com o limite carregado; depois de salvar, o campo já mostra o valor novo.
function FormularioLimite({ alunoId, limiteAtual, aoSalvar }: PropsFormulario) {
  const [limite, setLimite] = useState(limiteAtual === null ? '' : paraReais(limiteAtual))
  const [semLimite, setSemLimite] = useState(limiteAtual === null)
  const [enviando, setEnviando] = useState(false)
  const [mensagem, setMensagem] = useState<Mensagem | null>(null)

  async function salvarLimite(evento: FormEvent) {
    evento.preventDefault()
    setMensagem(null)
    const centavos = semLimite ? null : reaisParaCentavos(limite)
    if (!semLimite && centavos === null) {
      setMensagem({ tom: 'erro', texto: 'Informe um limite válido, com até duas casas decimais.' })
      return
    }
    setEnviando(true)
    try {
      await definirLimiteMensal(alunoId, centavos)
      setMensagem({ tom: 'sucesso', texto: 'Limite mensal atualizado.' })
      aoSalvar()
    } catch (e) {
      setMensagem({ tom: 'erro', texto: mensagemDeErro(e) })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form className="form-stack" onSubmit={salvarLimite}>
      <label>
        Limite mensal
        <div className="money-field">
          <span>R$</span>
          <input
            aria-label="Novo limite mensal"
            inputMode="decimal"
            value={limite}
            disabled={semLimite || enviando}
            onChange={(e) => setLimite(e.target.value)}
            placeholder="250,00"
            required={!semLimite}
          />
        </div>
      </label>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={semLimite}
          disabled={enviando}
          onChange={(e) => setSemLimite(e.target.checked)}
        />
        Sem limite mensal
      </label>
      {mensagem && <Aviso tom={mensagem.tom}>{mensagem.texto}</Aviso>}
      <button type="submit" className="button primary full" disabled={enviando}>
        Salvar limite
      </button>
      <small>
        O limite mensal impede compras acima do valor no mesmo mês. O teto de fiado de R$ 250,00 continua valendo.
      </small>
    </form>
  )
}

export function LimitesCreditos() {
  const { alunoId = '' } = useParams()
  const { dados: aluno, erro, carregando, recarregar } = useAssincrono(
    async () => (await listarAlunos()).find((a) => a.id === alunoId) ?? null,
    [alunoId],
  )

  if (aluno === null) {
    if (erro) return <Falha mensagem={erro} tentarDeNovo={recarregar} />
    if (carregando) return <Carregando />
    return (
      <div className="narrow-page">
        <Voltar para="/responsavel" />
        <section className="card">
          <Vazio titulo="Aluno não disponível" icone="usuarios">
            O aluno não está vinculado a esta conta.
          </Vazio>
        </section>
      </div>
    )
  }

  return (
    <div className="narrow-page">
      <Voltar para="/responsavel" />
      <div className="page-heading">
        <h1>{aluno.nome}</h1>
        <p className="muted">Limite de consumo e compra de créditos.</p>
      </div>
      <div className="limits-metrics">
        <Indicador rotulo="Saldo disponível" valor={formatarCentavos(aluno.saldo_centavos)} destaque />
        <Indicador
          rotulo="Limite mensal"
          valor={aluno.limite_mensal_centavos === null ? 'Sem limite' : formatarCentavos(aluno.limite_mensal_centavos)}
        />
        <Indicador rotulo="Gasto no mês" valor={formatarCentavos(aluno.gasto_mes_centavos)} destaque />
      </div>

      <section className="card settings-card">
        <h2>Configurações de consumo</h2>
        <FormularioLimite
          key={aluno.id}
          alunoId={aluno.id}
          limiteAtual={aluno.limite_mensal_centavos}
          aoSalvar={recarregar}
        />

        <ComprarCredito alunoId={aluno.id} nomeAluno={aluno.nome} aoSolicitar={recarregar} />

        <Link className="button secondary full spaced" to={`/responsavel/alunos/${alunoId}/extrato`}>
          Ver extrato completo
        </Link>
      </section>
    </div>
  )
}
