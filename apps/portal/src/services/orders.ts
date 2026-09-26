import type { OrderService } from '../types'
export const orders: OrderService = {
 supported: false,
 async confirm() { throw new Error('O envio de pedidos ainda não está disponível. Nenhum pedido foi enviado à cantina.') },
 async get() { return null },
}
