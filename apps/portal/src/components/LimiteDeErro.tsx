import { Component, type ReactNode } from 'react'

type Props = { chave: string; children: ReactNode }
type Estado = { erro: boolean; chave: string }

// Um erro ao desenhar uma tela mostra um aviso no lugar dela, em vez de deixar
// o portal inteiro em branco. Trocar de tela (nova chave) limpa o erro sem
// remontar o conteúdo, para as áreas não recarregarem a cada navegação.
export class LimiteDeErro extends Component<Props, Estado> {
  state: Estado = { erro: false, chave: this.props.chave }

  static getDerivedStateFromError(): Partial<Estado> {
    return { erro: true }
  }

  static getDerivedStateFromProps(props: Props, estado: Estado): Partial<Estado> | null {
    return props.chave === estado.chave ? null : { erro: false, chave: props.chave }
  }

  render() {
    if (!this.state.erro) return this.props.children
    return (
      <div className="notice erro" role="alert">
        <div>
          Algo deu errado ao mostrar esta tela.{' '}
          <button type="button" className="text-button" onClick={() => window.location.reload()}>
            Recarregar a página
          </button>
        </div>
      </div>
    )
  }
}
