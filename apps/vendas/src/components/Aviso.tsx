import type { ReactNode } from 'react'

type Props = { tipo: 'erro' | 'sucesso' | 'alerta' | 'info'; children: ReactNode }

export function Aviso({ tipo, children }: Props) {
  return (
    <div className={`aviso aviso-${tipo}`} role={tipo === 'erro' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}
