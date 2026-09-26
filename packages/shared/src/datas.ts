// Datas de calendário no fuso da cantina (America/Sao_Paulo), no formato
// YYYY-MM-DD usado pelo banco. O relógio do aparelho pode estar em outro fuso.
const FUSO = 'America/Sao_Paulo'
const formatoData = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' })

export function hojeEmSaoPaulo(): string {
  return formatoData.format(new Date())
}

export function somarDias(data: string, dias: number): string {
  const [ano, mes, dia] = data.split('-').map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10)
}

// Primeiro dia do mês corrente, como a coluna `competencia` das views mensais.
export function competenciaAtual(): string {
  return `${hojeEmSaoPaulo().slice(0, 7)}-01`
}
