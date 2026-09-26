import { Link, useSearchParams } from 'react-router-dom'
import { formatarCentavos } from '@wethebest/shared'
import { resumoDoPeriodo } from '../services/vendas'
import { fiadoEmAberto } from '../services/alunos'
import { useAssincrono } from '../hooks/useAssincrono'
import { limitesDoMes, mesAtual, rotuloMes } from '../utils/periodo'
import { Aviso } from '../components/Aviso'

// Relatório calculado na hora a partir das vendas e do extrato: nada é gravado
// e as vendas do mês continuam podendo ser canceladas dentro do prazo.
export function FechamentoMensal() {
  const [parametros, setParametros] = useSearchParams()
  const mes = /^\d{4}-\d{2}$/.test(parametros.get('mes') ?? '') ? parametros.get('mes')! : mesAtual()

  const resumo = useAssincrono(() => {
    const { inicio, fim } = limitesDoMes(mes)
    return resumoDoPeriodo(inicio, fim)
  }, [mes])
  const fiado = useAssincrono(fiadoEmAberto, [])
  const dados = resumo.dados

  return (
    <main className="pagina pagina-estreita">
      <div className="pagina-topo">
        <div>
          <h1>Fechamento mensal</h1>
          <p className="subtitulo">Confira os valores do período.</p>
        </div>
        <label className="campo nao-imprimir">
          <span>Mês</span>
          <input
            type="month"
            value={mes}
            max={mesAtual()}
            onChange={(e) => e.target.value && setParametros({ mes: e.target.value }, { replace: true })}
          />
        </label>
      </div>

      <div className="aviso aviso-info">
        <strong>{rotuloMes(mes)}</strong>
        <p className="texto-apoio">
          Só vendas confirmadas entram nos totais. O fiado continua em aberto no saldo de cada aluno até ser pago.
        </p>
      </div>

      {resumo.erro && <Aviso tipo="erro">{resumo.erro}</Aviso>}

      <section className="cartao">
        <h2>Resumo do período</h2>
        {!dados ? (
          <p className="vazio-bloco">{resumo.erro ? 'Não foi possível calcular o resumo.' : 'Calculando...'}</p>
        ) : (
          <div>
            <Linha rotulo="Total de vendas" valor={formatarCentavos(dados.total_centavos)} destaque />
            <Linha rotulo="Quantidade de vendas" valor={String(dados.quantidade_vendas)} />
            <Linha
              rotulo="Recebido na hora"
              detalhe="Clientes sem cadastro, pagos no balcão"
              valor={formatarCentavos(dados.avulsas_centavos)}
            />
            <Linha
              rotulo="Na conta dos alunos"
              detalhe="Debitado do saldo; o que faltou virou fiado"
              valor={formatarCentavos(dados.conta_centavos)}
            />
            <Linha
              rotulo="Pedidos antecipados"
              detalhe="Já incluídos na conta dos alunos"
              valor={formatarCentavos(dados.pedidos_centavos)}
            />
            <Linha rotulo="Vendas canceladas" valor={String(dados.canceladas)} />
          </div>
        )}
      </section>

      {dados && (
        <section className="cartao">
          <h2>Dinheiro que entrou</h2>
          <Linha rotulo="Vendas pagas na hora" valor={formatarCentavos(dados.avulsas_centavos)} />
          <Linha rotulo="Créditos comprados por Pix" valor={formatarCentavos(dados.creditos_pix_centavos)} />
          <Linha rotulo="Fiado pago no balcão" valor={formatarCentavos(dados.pagamentos_balcao_centavos)} />
          <Linha
            rotulo="Total recebido"
            valor={formatarCentavos(
              dados.avulsas_centavos + dados.creditos_pix_centavos + dados.pagamentos_balcao_centavos,
            )}
            destaque
          />
        </section>
      )}

      <section className="cartao">
        <div className="fechamento-linha">
          <span>
            <strong>Valores em fiado</strong>
            <small>Soma do que os alunos devem hoje, em todos os meses.</small>
          </span>
          <strong className="negativo">{fiado.dados === null ? (fiado.erro ? '—' : '...') : formatarCentavos(fiado.dados)}</strong>
        </div>
      </section>

      <div className="pagina-topo nao-imprimir" style={{ justifyContent: 'flex-end' }}>
        <Link to="/vendas" className="botao botao-secundario">
          Voltar
        </Link>
        <button type="button" className="botao botao-primario" disabled={!dados} onClick={() => window.print()}>
          Imprimir fechamento
        </button>
      </div>
    </main>
  )
}

function Linha({ rotulo, valor, detalhe, destaque }: { rotulo: string; valor: string; detalhe?: string; destaque?: boolean }) {
  return (
    <div className={`fechamento-linha${destaque ? ' destaque' : ''}`}>
      <span>
        {rotulo}
        {detalhe && <small>{detalhe}</small>}
      </span>
      <strong>{valor}</strong>
    </div>
  )
}
