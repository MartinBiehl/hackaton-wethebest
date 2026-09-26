import type { StatusPedido } from '../services/pedidos'
import type { Movimento } from '../services/extrato'

export const STATUS_PEDIDO: Record<StatusPedido, string> = {
  aguardando_pagamento: 'Aguardando pagamento',
  pago: 'Pago · aguardando retirada',
  entregue: 'Retirado',
  nao_retirado: 'Não retirado',
  expirado: 'Expirado',
  recusado: 'Recusado',
  cancelado: 'Cancelado',
}

export const TIPO_MOVIMENTO: Record<Movimento['tipo'], string> = {
  compra: 'Compra na cantina',
  credito: 'Crédito',
  pagamento: 'Pagamento na cantina',
  estorno: 'Estorno de compra cancelada',
  ajuste: 'Ajuste',
}
