import type { CSSProperties } from 'react'

// Ícones de traço em 24×24, na cor do texto ao redor.
const CAMINHOS: Record<string, string> = {
  seta: 'M19 12H5m6-6-6 6 6 6',
  busca: 'm21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  sacola: 'M5 7h14l1 14H4L5 7Zm3 0V5a4 4 0 0 1 8 0v2',
  usuario: 'M20 21v-2a7 7 0 0 0-14 0v2M17 6a5 5 0 1 1-10 0 5 5 0 0 1 10 0',
  usuarios:
    'M16 21v-2a6 6 0 0 0-12 0v2m18 0v-2a6 6 0 0 0-4-5M15 3a4 4 0 0 1 0 8M14 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  carteira: 'M20 8V5H5a3 3 0 0 0 0 6h16v10H5a3 3 0 0 1-3-3V8m19 6h-6v4h6m-3-2h.01',
  calendario: 'M4 5h16v16H4V5Zm4-3v6m8-6v6M4 10h16m-12 4h2m4 0h2m-8 4h2',
  relogio: 'M12 7v5l3 2m7-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  check: 'm5 12 4 4L19 6',
  mais: 'M12 5v14M5 12h14',
  menos: 'M5 12h14',
  lixeira: 'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',
  info: 'M12 11v6m0-10h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  sair: 'M9 4H4v16h5m5-4 4-4-4-4m-6 4h12',
  recibo: 'M5 3h14v19l-3-2-4 2-4-2-3 2V3Zm4 5h6m-6 4h6m-6 4h4',
  lanche: 'M3 11 12 3l9 8H3Zm0 3h18v7H3v-7Zm0 3 4 2 5-2 5 2 4-2',
  fechar: 'm6 6 12 12M6 18 18 6',
}

export function Icone({ nome, tamanho = 20, style }: { nome: string; tamanho?: number; style?: CSSProperties }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={CAMINHOS[nome] ?? CAMINHOS.info} />
    </svg>
  )
}
