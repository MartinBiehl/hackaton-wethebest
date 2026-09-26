import { useState, type FormEvent } from 'react'
import { entrar } from '../services/auth'
import { mensagemDeErro } from '../utils/erro'
import { Aviso } from '../components/Aviso'

// Depois do login, useSessao percebe a sessão nova e o App troca de tela.
export function Login() {
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
    <main className="login">
      <form className="cartao formulario" onSubmit={enviar}>
        <div>
          <h1>iCarla</h1>
          <p className="subtitulo">Entre com a conta da cantina para registrar vendas.</p>
        </div>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <label className="campo">
          <span>E-mail</span>
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="campo">
          <span>Senha</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </label>
        <button type="submit" className="botao botao-primario" disabled={enviando}>
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}
