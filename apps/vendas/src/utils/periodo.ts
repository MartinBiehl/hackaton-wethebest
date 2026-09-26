import { hojeEmSaoPaulo } from '@wethebest/shared'

// São Paulo não tem horário de verão desde 2019: UTC−3 o ano todo.
const DESLOCAMENTO = '-03:00'
const FUSO = 'America/Sao_Paulo'
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

// Mês no formato "YYYY-MM", o mesmo do <input type="month">.
export function mesAtual(): string {
  return hojeEmSaoPaulo().slice(0, 7)
}

// Limites do mês para filtrar `criado_em`: início incluso, fim excluído.
export function limitesDoMes(mes: string): { inicio: string; fim: string } {
  const [ano, numero] = mes.split('-').map(Number)
  const proximo = numero === 12 ? `${ano + 1}-01` : `${ano}-${String(numero + 1).padStart(2, '0')}`
  return { inicio: `${mes}-01T00:00:00${DESLOCAMENTO}`, fim: `${proximo}-01T00:00:00${DESLOCAMENTO}` }
}

export function rotuloMes(mes: string): string {
  const [ano, numero] = mes.split('-').map(Number)
  return `${MESES[numero - 1]} de ${ano}`
}

const formatoDataHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

export function dataHora(iso: string): string {
  return formatoDataHora.format(new Date(iso))
}

// "2026-09-26" → "26/09/2026"
export function dataCurta(data: string): string {
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

// O banco devolve "HH:MM:SS"; a tela mostra "HH:MM".
export function horario(hora: string): string {
  return hora.slice(0, 5)
}
