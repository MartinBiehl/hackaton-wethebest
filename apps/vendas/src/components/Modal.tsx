import { useEffect, useId, type ReactNode } from 'react'

type Props = {
  titulo: string
  aoFechar: () => void
  children: ReactNode
  rodape?: ReactNode
}

export function Modal({ titulo, aoFechar, children, rodape }: Props) {
  const idTitulo = useId()

  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => evento.key === 'Escape' && aoFechar()
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [aoFechar])

  return (
    <div className="modal-fundo" onMouseDown={(evento) => evento.target === evento.currentTarget && aoFechar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={idTitulo}>
        <h2 id={idTitulo}>{titulo}</h2>
        {children}
        {rodape && <div className="modal-rodape">{rodape}</div>}
      </div>
    </div>
  )
}
