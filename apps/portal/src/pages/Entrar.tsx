import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { entrar } from '../services/auth'
import { mensagemDeErro } from '../utils/erro'
import { Aviso } from '../components/ui'

// Depois do login, useSessao percebe a sessão nova e o App troca de tela.
export function Entrar() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    setEnviando(true)
    setErro(null)
    try {
      await entrar(email, senha)
    } catch (e) {
      setErro(mensagemDeErro(e))
      setEnviando(false)
    }
  }

  return (
    <main className="access-state">
      <span className="brand-mark">iC</span>
      <h1>iCarla</h1>
      <form className="card form-stack" onSubmit={enviar}>
        <p className="muted">Entre para acompanhar a conta da cantina.</p>
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        <label>
          E-mail
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Senha
          <input
            type="password"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </label>
        <button type="submit" className="button primary full" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <p className="access-switch">
        Ainda não tem conta? <Link to="/cadastro">Criar conta</Link>
      </p>
    </main>
  )
}
