import type { Item, Product } from '../types'
export const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100)
export const intervals = [{ id: 'manha', label: '1º intervalo', time: '09:20' }, { id: 'tarde', label: '2º intervalo', time: '15:30' }]
export function schoolDate(now = new Date()): string {
 const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
 return ['year', 'month', 'day'].map(type => parts.find(p => p.type === type)!.value).join('-')
}
export const currentMonth = () => schoolDate().slice(0, 7)
export function monthRange(month: string) {
 if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Escolha um mês válido.')
 const [year, m] = month.split('-').map(Number)
 return { start: `${month}-01T00:00:00-03:00`, end: `${m === 12 ? year + 1 : year}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01T00:00:00-03:00` }
}
export function formatDate(date: string) { return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(new Date(date + 'T12:00:00-03:00')) }
export function shortDate(date: string) { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(date)) }
export const totalItems = (items: Item[]) => items.reduce((n, i) => n + i.preco * i.quantidade, 0)
export const units = (items: Item[]) => items.reduce((n, i) => n + i.quantidade, 0)
export function parseMoney(raw: string) {
 if (!/^\d+(?:[.,]\d{1,2})?$/.test(raw.trim())) return null
 const result = Math.round(Number(raw.trim().replace(',', '.')) * 100)
 return Number.isSafeInteger(result) && result >= 0 ? result : null
}
export function isOpen(date: string, slot: string, now = Date.now()) {
 const interval = intervals.find(i => i.id === slot)
 if (!interval || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
 return now < new Date(date + 'T' + interval.time + ':00-03:00').getTime() - 15 * 60 * 1000
}
export function initialDate() { const today = schoolDate(); return isOpen(today, 'tarde') ? today : schoolDate(new Date(new Date(today + 'T12:00:00-03:00').getTime() + 86400000)) }
export function normalize(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() }
const presentation: Record<string, [string, string]> = {
 'coxinha de frango': ['Salgados', 'snack'], 'coxinha': ['Salgados', 'snack'], 'pao de queijo': ['Salgados', 'bread'],
 'suco de laranja': ['Bebidas', 'cup'], 'agua mineral': ['Bebidas', 'bottle'], 'agua': ['Bebidas', 'bottle'], 'sanduiche natural': ['Lanches', 'sandwich'],
}
export function productPresentation(name: string) { const [categoria, icon] = presentation[normalize(name)] || ['Outros', 'bag']; return { categoria, icon } }
export function filterProducts(products: Product[], query: string, category: string) { return products.filter(p => normalize(p.nome).includes(normalize(query)) && (category === 'Todos' || p.categoria === category)) }
