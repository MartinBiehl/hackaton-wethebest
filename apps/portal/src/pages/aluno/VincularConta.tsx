import { useState, type FormEvent } from 'react'
import { vincularContaAluno, type ResultadoVinculoConta } from '../../services/vinculos'
import { mensagemDeErro } from '../../utils/erro'
import { Aviso, Modal } from '../../components/ui'

// Logo após o cadastro o aluno ainda não tem registro: ele informa o e-mail do
// responsável que fez o pré-cadastro. O banco nunca revela se um e-mail existe.
export function VincularConta({ aoConcluir }: { aoConcluir: () => void }) {
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoVinculoConta['status'] | null>(null)
  const [semResponsavel, setSemResponsavel] = useState(false)

  async function vincular(emailResponsavel: string) {
    setEnviando(true)
    setErro(null)
    try {
      const { status } = await vincularContaAluno(emailResponsavel)
      setResultado(status)
      setSemResponsavel(false)
      aoConcluir()
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setEnviando(false)
    }
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    void vincular(email)
  }

  return (
    <div className="narrow-page">
      <div className="page-heading">
        <h1>Ligar sua conta</h1>
        <p className="muted">
          Informe o e-mail do responsável que cadastrou você na cantina. Ele vai aprovar sua conta pelo portal.
        </p>
      </div>
      <form className="card form-stack" onSubmit={enviar}>
        {resultado === 'aguardando_aprovacao' && (
          <Aviso>
            Pedido enviado. Se o seu e-mail e o do responsável estiverem certos, a conta passa a aguardar a aprovação
            dele. Se nada mudar, confira com ele qual e-mail foi usado no cadastro.
          </Aviso>
        )}
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        <label>
          E-mail do responsável
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={enviando} />
        </label>
        <button type="submit" className="button primary full" disabled={enviando}>
          {enviando ? 'Enviando…' : 'Ligar minha conta'}
        </button>
        <button type="button" className="text-button" onClick={() => setSemResponsavel(true)} disabled={enviando}>
          Não tenho responsável cadastrado
        </button>
      </form>

      {semResponsavel && (
        <Modal titulo="Usar conta sem responsável" aoFechar={() => !enviando && setSemResponsavel(false)}>
          <p>Sua conta passa a funcionar sozinha: você compra créditos e faz pedidos sem um responsável acompanhando.</p>
          <Aviso>Se um responsável cadastrar você depois, o vínculo com ele vai precisar da sua aprovação.</Aviso>
          {erro && <Aviso tom="erro">{erro}</Aviso>}
          <div className="button-row">
            <button
              type="button"
              className="button secondary"
              disabled={enviando}
              onClick={() => setSemResponsavel(false)}
            >
              Voltar
            </button>
            <button type="button" className="button primary" disabled={enviando} onClick={() => void vincular('')}>
              {enviando ? 'Criando…' : 'Continuar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
