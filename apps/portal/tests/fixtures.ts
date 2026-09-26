import type { ConfirmedOrder, Item, PortalService, Profile, Student } from '../src/types'
import { currentMonth, productPresentation, schoolDate } from '../src/utils/format'
export const items: Item[] = [{ productId: 'coxinha', nome: 'Coxinha de frango', preco: 700, quantidade: 2 }, { productId: 'suco', nome: 'Suco de laranja', preco: 600, quantidade: 1 }]
export const student: Student = { id: 'joao', nome: 'João da Silva', email: 'joao@example.test', saldo: 5000, gasto: 18000, limite: 30000, pendente: false }
export const parent: Profile = { id: 'marina', nome: 'Marina Oliveira', email: 'marina@example.test', papel: 'responsavel' }
export const profile: Profile = { id: 'joao', nome: 'João da Silva', email: student.email, papel: 'aluno' }
export const family: Student[] = [
 { id: 'lara', nome: 'Lara Monteiro', email: 'lara@example.test', turma: '4º ano · Turma A', saldo: 7500, gasto: 21450, limite: 30000, pendente: false },
 { id: 'murilo', nome: 'Murilo Monteiro', email: 'murilo@example.test', turma: '2º ano · Turma B', saldo: 6000, gasto: 18000, limite: 25000, pendente: false },
 { id: 'sofia', nome: 'Sofia Monteiro', email: 'sofia@example.test', turma: '6º ano · Turma C', saldo: 5000, gasto: 24800, limite: 35000, pendente: false },
]
export function makeService(role: 'aluno' | 'responsavel' = 'aluno', ordersSupported = false): PortalService {
 const students = structuredClone([student, ...family])
 const products = [
  { id: 'coxinha', nome: 'Coxinha de frango', preco: 700 }, { id: 'pao', nome: 'Pão de queijo', preco: 500 }, { id: 'suco', nome: 'Suco de laranja', preco: 600 }, { id: 'agua', nome: 'Água mineral', preco: 400 }, { id: 'sanduiche', nome: 'Sanduíche natural', preco: 1250 },
 ].map(p => ({ ...p, descricao: '', ...productPresentation(p.nome), disponibilidade: 'disponivel' as const }))
 const movements = products.map((p, i) => ({ id: 'm' + i, alunoId: 'lara', data: currentMonth() + '-' + String(12 - i).padStart(2, '0') + 'T10:00:00-03:00', descricao: 'Compra na cantina', valor: -p.preco * (i % 2 ? 1 : 2), tipo: 'compra', itens: [{ productId: p.id, nome: p.nome, preco: p.preco, quantidade: i % 2 ? 1 : 2 }] }))
 const order: ConfirmedOrder = { id: 'IC-2048', alunoId: 'joao', data: schoolDate(new Date(Date.now() + 86400000)), intervalo: 'manha', itens: items, total: 2000, codigoRetirada: 'IC-2048' }
 return {
  configured: true, getProfile: async () => role === 'aluno' ? profile : parent, onSessionChange: () => () => {},
  listStudents: async () => students.filter(s => s.id !== 'joao').map(s => ({ ...s })),
  getStudent: async id => { const s = students.find(s => s.id === (id || 'joao')); return s ? { ...s } : null },
  listProducts: async () => products, recentPurchases: async () => movements,
  statement: async (id, month, page) => ({ entries: month === currentMonth() && page === 0 ? movements.map(m => ({ ...m, alunoId: id })) : [], totalExpense: month === currentMonth() ? students.find(s => s.id === id)?.gasto || 0 : 0, totalCount: month === currentMonth() ? movements.length : 0 }),
  setLimit: async (id, value) => { students.find(s => s.id === id)!.limite = value },
  addCredit: async (id, value) => { students.find(s => s.id === id)!.saldo += value },
  orders: { supported: ordersSupported, get: async id => ordersSupported && id === order.id ? order : null, confirm: async () => { if (!ordersSupported) throw new Error('Indisponível'); return order } },
 }
}
