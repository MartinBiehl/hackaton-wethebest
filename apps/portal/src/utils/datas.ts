import { hojeEmSaoPaulo } from '@wethebest/shared'

// São Paulo não tem horário de verão desde 2019: UTC−3 o ano todo.
const DESLOCAMENTO = '-03:00'
const FUSO = 'America/Sao_Paulo'

// Espelha antecedencia_pedido() do banco, que é quem de fato recusa o pedido.
const ANTECEDENCIA_PEDIDO_MS = 30 * 60 * 1000

// Mês no formato "YYYY-MM", o mesmo do <input type="month">.
export function mesAtual(): string {
  return hojeEmSaoPaulo().slice(0, 7)
}

export function mesValido(mes: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(mes)
}

// Limites do mês para filtrar `criado_em`: início incluso, fim excluído.
export function limitesDoMes(mes: string): { inicio: string; fim: string } {
  const [ano, numero] = mes.split('-').map(Number)
  const proximo = numero === 12 ? `${ano + 1}-01` : `${ano}-${String(numero + 1).padStart(2, '0')}`
  return { inicio: `${mes}-01T00:00:00${DESLOCAMENTO}`, fim: `${proximo}-01T00:00:00${DESLOCAMENTO}` }
}

// Mês (YYYY-MM) em que um instante caiu, no fuso da cantina.
export function mesDe(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit' }).format(new Date(iso))
}

// Instante em que o intervalo deixa de aceitar pedidos para a data informada.
export function corteDoPedido(data: string, inicio: string): number {
  return new Date(`${data}T${inicio}${DESLOCAMENTO}`).getTime() - ANTECEDENCIA_PEDIDO_MS
}

const formatoDataHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})
const formatoHora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' })
const formatoDiaMes = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit' })
const formatoDataLonga = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

export function dataHora(iso: string): string {
  return formatoDataHora.format(new Date(iso))
}

export function hora(iso: string): string {
  return formatoHora.format(new Date(iso))
}

export function diaMes(iso: string): string {
  return formatoDiaMes.format(new Date(iso))
}

// "2026-09-26" → "26/09"
export function dataCurta(data: string): string {
  const [, mes, dia] = data.split('-')
  return `${dia}/${mes}`
}

// "2026-09-26" → "sábado, 26 de setembro"
export function dataLonga(data: string): string {
  return formatoDataLonga.format(new Date(`${data}T12:00:00${DESLOCAMENTO}`))
}

// O banco devolve "HH:MM:SS"; a tela mostra "HH:MM".
export function horario(horaBanco: string): string {
  return horaBanco.slice(0, 5)
}
