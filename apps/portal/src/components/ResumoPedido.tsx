import type { ReactNode } from 'react'
import { formatarCentavos } from '@wethebest/shared'

export type LinhaResumo = { chave: string; nome: string; quantidade: number; subtotal_centavos: number }

export function ResumoPedido({ linhas, children }: { linhas: LinhaResumo[]; children?: ReactNode }) {
  const unidades = linhas.reduce((soma, linha) => soma + linha.quantidade, 0)
  const total = linhas.reduce((soma, linha) => soma + linha.subtotal_centavos, 0)

  return (
    <section className="card order-summary" aria-label="Resumo do pedido">
      <div className="section-heading">
        <h2>Resumo do pedido</h2>
        <span className="badge">
          {unidades} {unidades === 1 ? 'unidade' : 'unidades'}
        </span>
      </div>
      <div className="summary-lines">
        {linhas.map((linha) => (
          <div key={linha.chave}>
            <span>
              {linha.quantidade}× {linha.nome}
            </span>
            <strong>{formatarCentavos(linha.subtotal_centavos)}</strong>
          </div>
        ))}
      </div>
      <div className="summary-total">
        <strong>Total</strong>
        <strong>{formatarCentavos(total)}</strong>
      </div>
      {children}
    </section>
  )
}
