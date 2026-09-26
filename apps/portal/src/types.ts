export type Profile = { id: string; nome: string; email: string; papel: 'aluno' | 'responsavel' }
export type Student = { id: string; nome: string; email: string; turma?: string; saldo: number; gasto: number; limite: number | null; pendente: boolean }
export type Product = { id: string; nome: string; descricao: string; preco: number; categoria: string; icon: string; disponibilidade: 'disponivel' | 'indisponivel' | 'desconhecida' }
export type Item = { productId: string; nome: string; preco: number; quantidade: number }
export type Movement = { id: string; alunoId: string; data: string; descricao: string; valor: number; tipo: string; itens: Item[] }
export type Statement = { entries: Movement[]; totalExpense: number; totalCount: number }
export type OrderRequest = { alunoId: string; data: string; intervalo: string; itens: { produtoId: string; quantidade: number }[] }
export type ConfirmedOrder = { id: string; alunoId: string; data: string; intervalo: string; itens: Item[]; total: number; codigoRetirada?: string }
export interface OrderService {
 supported: boolean
 confirm(request: OrderRequest): Promise<ConfirmedOrder>
 get(id: string): Promise<ConfirmedOrder | null>
}
export interface PortalService {
 configured: boolean
 getProfile(): Promise<Profile | null>
 onSessionChange(callback: () => void): () => void
 listStudents(): Promise<Student[]>
 getStudent(id?: string): Promise<Student | null>
 listProducts(): Promise<Product[]>
 recentPurchases(): Promise<Movement[]>
 statement(id: string, month: string, page: number): Promise<Statement>
 setLimit(id: string, value: number | null): Promise<void>
 addCredit(id: string, value: number): Promise<void>
 orders: OrderService
}
