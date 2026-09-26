import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { cadastrar, type PapelPortal } from '../services/auth'
import { mensagemDeErro } from '../utils/erro'
import { Aviso } from '../components/ui'

const PAPEIS: { valor: PapelPortal; titulo: string; descricao: string }[] = [
  { valor: 'responsavel', titulo: 'Sou responsável', descricao: 'Acompanho o consumo e compro créditos.' },
  { valor: 'aluno', titulo: 'Sou aluno', descricao: 'Faço pedidos para retirar no intervalo.' },
]

// Com sessão aberta no cadastro, useSessao troca de tela sozinho.
export function Cadastro() {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [papel, setPapel] = useState<PapelPortal>('responsavel')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmarEmail, setConfirmarEmail] = useState(false)

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    setEnviando(true)
    setErro(null)
    try {
      const { precisaConfirmarEmail } = await cadastrar({ nome, email, senha, papel })
      setConfirmarEmail(precisaConfirmarEmail)
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setEnviando(false)
    }
  }

  if (confirmarEmail) {
    return (
      <main className="access-state">
        <span className="brand-mark">iC</span>
        <h1>iCarla</h1>
        <section className="card form-stack">
          <Aviso tom="sucesso">
            Conta criada. Enviamos um link para <strong>{email}</strong>: confirme o e-mail e depois entre.
          </Aviso>
          <Link className="button primary full" to="/">
            Ir para o login
          </Link>
        </section>
      </main>
    )
  }

  return (
    <main className="access-state">
      <span className="brand-mark">iC</span>
      <h1>iCarla</h1>
      <form className="card form-stack" onSubmit={enviar}>
        <fieldset className="slot-fields">
          <legend>Quem vai usar esta conta?</legend>
          {PAPEIS.map((opcao) => (
            <label key={opcao.valor} className={papel === opcao.valor ? 'slot selected' : 'slot'}>
              <input
                type="radio"
                name="papel"
                checked={papel === opcao.valor}
                onChange={() => setPapel(opcao.valor)}
              />
              <span>
                <strong>{opcao.titulo}</strong>
                <small>{opcao.descricao}</small>
              </span>
            </label>
          ))}
        </fieldset>
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        <label>
          Nome completo
          <input autoComplete="name" required value={nome} onChange={(e) => setNome(e.target.value)} />
        </label>
        <label>
          E-mail
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Senha
          <input
            type="password"
            autoComplete="new-password"
            minLength={6}
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </label>
        {papel === 'aluno' && (
          <small>Use o mesmo e-mail que seu responsável informou no cadastro dele, para ligar as duas contas.</small>
        )}
        <button type="submit" className="button primary full" disabled={enviando}>
          {enviando ? 'Criando conta…' : 'Criar conta'}
        </button>
      </form>
      <p className="access-switch">
        Já tem conta? <Link to="/">Entrar</Link>
      </p>
    </main>
  )
}
