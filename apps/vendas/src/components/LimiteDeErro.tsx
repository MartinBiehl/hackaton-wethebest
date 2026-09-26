import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode }
type Estado = { erro: boolean }

// Um erro ao desenhar uma tela mostra um aviso no lugar dela, em vez de deixar
// o app inteiro em branco. O cabeçalho continua funcionando para trocar de tela.
export class LimiteDeErro extends Component<Props, Estado> {
  state: Estado = { erro: false }

  static getDerivedStateFromError(): Estado {
    return { erro: true }
  }

  render() {
    if (!this.state.erro) return this.props.children
    return (
      <main className="pagina">
        <div className="aviso aviso-erro" role="alert">
          Algo deu errado ao mostrar esta tela.{' '}
          <button type="button" className="botao botao-fantasma perigo" onClick={() => window.location.reload()}>
            Recarregar a página
          </button>
        </div>
      </main>
    )
  }
}
