// Valores monetários trafegam sempre em centavos inteiros (ver docs/DECISIONS.md).
const formatador = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatarCentavos(centavos: number): string {
  return formatador.format(centavos / 100)
}

// Converte o que a Carla digita ("12,50", "12.50", "R$ 12") em centavos.
// Retorna null quando o texto não é um valor válido.
export function reaisParaCentavos(texto: string): number | null {
  const limpo = texto.replace(/R\$|\s/g, '')
  if (!/^\d+([.,]\d{1,2})?$/.test(limpo)) return null
  const [reais, fracao = ''] = limpo.split(/[.,]/)
  return Number(reais) * 100 + Number(fracao.padEnd(2, '0'))
}
