import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icone } from './Icone'

type TomAviso = 'info' | 'erro' | 'sucesso' | 'alerta'

export function Aviso({ tom = 'info', children }: { tom?: TomAviso; children: ReactNode }) {
  return (
    <div className={`notice ${tom}`} role={tom === 'erro' ? 'alert' : 'status'}>
      <Icone nome={tom === 'sucesso' ? 'check' : 'info'} tamanho={18} />
      <div>{children}</div>
    </div>
  )
}

export function Indicador({ rotulo, valor, destaque = false }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className={destaque ? 'metric accent' : 'metric'}>
      <span>{rotulo}</span>
      <strong>{valor}</strong>
    </div>
  )
}

export function Vazio({ titulo, icone = 'recibo', children }: { titulo: string; icone?: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icone nome={icone} tamanho={28} />
      </span>
      <h3>{titulo}</h3>
      {children && <p>{children}</p>}
    </div>
  )
}

const ETAPAS = ['Meu pedido', 'Retirada', 'Confirmação']

export function Etapas({ atual }: { atual: number }) {
  return (
    <ol className="steps" aria-label="Etapas do pedido">
      {ETAPAS.map((rotulo, indice) => {
        const numero = indice + 1
        return (
          <li key={rotulo} className={numero <= atual ? 'active' : ''} aria-current={numero === atual ? 'step' : undefined}>
            <span>{numero < atual ? <Icone nome="check" tamanho={12} /> : numero}</span>
            {rotulo}
          </li>
        )
      })}
    </ol>
  )
}

export function Carregando() {
  return (
    <p className="loading" role="status">
      Carregando informações…
    </p>
  )
}

export function Falha({ mensagem, tentarDeNovo }: { mensagem: string; tentarDeNovo?: () => void }) {
  return (
    <div className="failure">
      <Aviso tom="erro">{mensagem}</Aviso>
      {tentarDeNovo && (
        <button type="button" className="button secondary" onClick={tentarDeNovo}>
          Tentar novamente
        </button>
      )}
    </div>
  )
}

export function Voltar({ para, children = 'Voltar para o início' }: { para: string; children?: ReactNode }) {
  return (
    <Link to={para} className="back-link">
      <Icone nome="seta" tamanho={15} />
      {children}
    </Link>
  )
}

type PropsModal = { titulo: string; aoFechar: () => void; children: ReactNode }

// <dialog> nativo: prende o foco e fecha com Esc.
export function Modal({ titulo, aoFechar, children }: PropsModal) {
  const ref = useRef<HTMLDialogElement>(null)
  const idTitulo = useId()

  useEffect(() => {
    const dialogo = ref.current
    dialogo?.showModal()
    return () => dialogo?.close()
  }, [])

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={idTitulo}
      onCancel={(evento) => {
        evento.preventDefault()
        aoFechar()
      }}
    >
      <div className="section-heading">
        <h2 id={idTitulo}>{titulo}</h2>
        <button type="button" className="icon-button" onClick={aoFechar} aria-label="Fechar">
          <Icone nome="fechar" />
        </button>
      </div>
      {children}
    </dialog>
  )
}
