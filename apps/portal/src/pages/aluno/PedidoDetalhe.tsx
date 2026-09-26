import { Link, useParams } from 'react-router-dom'
import { formatarCentavos } from '@wethebest/shared'
import { buscarPedido, type PedidoDetalhado } from '../../services/pedidos'
import { useAssincrono } from '../../hooks/useAssincrono'
import { dataLonga, hora, horario } from '../../utils/datas'
import { STATUS_PEDIDO } from '../../utils/rotulos'
import { Icone } from '../../components/Icone'
import { ResumoPedido } from '../../components/ResumoPedido'
import { Aviso, Carregando, Etapas, Falha, Vazio, Voltar } from '../../components/ui'

// Título e explicação de cada situação do pedido, na visão do aluno.
function situacao(pedido: PedidoDetalhado): { titulo: string; texto: string; sucesso: boolean } {
  switch (pedido.status) {
    case 'pago':
      return { titulo: 'Pedido agendado!', texto: 'Seu pedido está pago e vai esperar por você na cantina.', sucesso: true }
    case 'aguardando_pagamento':
      return {
        titulo: 'Aguardando pagamento',
        texto: 'O pedido só é confirmado quando a cantina receber o Pix.',
        sucesso: false,
      }
    case 'entregue':
      return { titulo: 'Pedido retirado', texto: 'Bom lanche!', sucesso: true }
    case 'nao_retirado':
      return { titulo: 'Pedido não retirado', texto: 'O pedido não foi retirado no intervalo e não é devolvido.', sucesso: false }
    case 'expirado':
      return { titulo: 'Pedido expirado', texto: 'O Pix não foi pago dentro do prazo.', sucesso: false }
    case 'recusado':
      return {
        titulo: 'Pedido recusado',
        texto: 'O pagamento chegou, mas o pedido não pôde ser atendido. O valor pago ficou como crédito no seu saldo.',
        sucesso: false,
      }
    case 'cancelado':
      return { titulo: 'Pedido cancelado', texto: 'A cantina cancelou o pedido e o valor voltou para o seu saldo.', sucesso: false }
  }
}

export function PedidoDetalhe() {
  const { pedidoId = '' } = useParams()
  const { dados: pedido, erro, carregando, recarregar } = useAssincrono(() => buscarPedido(pedidoId), [pedidoId], 5000)

  if (pedido === null) {
    if (erro) return <Falha mensagem={erro} tentarDeNovo={recarregar} />
    if (carregando) return <Carregando />
    return (
      <div className="narrow-page">
        <section className="card">
          <Vazio titulo="Pedido não encontrado" icone="sacola">
            Confira a lista dos seus pedidos.
          </Vazio>
          <Link className="button primary full" to="/aluno/pedidos">
            Ver meus pedidos
          </Link>
        </section>
      </div>
    )
  }

  const { titulo, texto, sucesso } = situacao(pedido)
  const pagamentoPendente = pedido.status === 'aguardando_pagamento' ? pedido.pagamento : null

  return (
    <div className="narrow-page">
      <Voltar para="/aluno/pedidos">Meus pedidos</Voltar>
      {(pedido.status === 'pago' || pedido.status === 'aguardando_pagamento') && (
        <Etapas atual={pedido.status === 'pago' ? 4 : 3} />
      )}
      <section className="card confirmation">
        <div className={sucesso ? 'success-circle' : 'success-circle neutral'}>
          <Icone nome={sucesso ? 'check' : pedido.status === 'aguardando_pagamento' ? 'relogio' : 'info'} tamanho={31} />
        </div>
        <h1>{titulo}</h1>
        <p className="muted">{texto}</p>

        {pagamentoPendente && (
          <div className="pickup-code pix-box">
            <span>Pix de {formatarCentavos(pagamentoPendente.valor_centavos)}</span>
            <strong>Pague até {hora(pagamentoPendente.expira_em)}</strong>
            <small>Depois desse horário o pedido expira sozinho.</small>
          </div>
        )}
        {pedido.motivo && <Aviso>{pedido.motivo}</Aviso>}

        <div className="pickup-card">
          <Icone nome="calendario" tamanho={22} />
          <div>
            <span>RETIRADA</span>
            <strong>{dataLonga(pedido.data_retirada)}</strong>
            <small>
              {pedido.intervalo ?? 'Intervalo'}
              {pedido.inicio_intervalo ? ` · ${horario(pedido.inicio_intervalo)}` : ''}
            </small>
          </div>
        </div>

        <ResumoPedido
          linhas={pedido.itens.map((item, indice) => ({
            chave: String(indice),
            nome: item.nome_produto,
            quantidade: item.quantidade,
            subtotal_centavos: item.subtotal_centavos,
          }))}
        />
        <p className="fine-print">
          {STATUS_PEDIDO[pedido.status]} · {pedido.forma_pagamento === 'pix' ? 'Pix' : 'Saldo da conta'}
        </p>

        {pagamentoPendente && (
          <button type="button" className="button secondary full" onClick={recarregar} disabled={carregando}>
            {carregando ? 'Atualizando…' : 'Atualizar situação'}
          </button>
        )}
        <Link className="button primary full spaced" to="/aluno">
          Voltar para o cardápio
        </Link>
      </section>
    </div>
  )
}
