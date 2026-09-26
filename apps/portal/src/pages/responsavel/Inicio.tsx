import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { formatarCentavos } from '@wethebest/shared'
import { cadastrarAluno, listarAlunos, type AlunoPortal } from '../../services/alunos'
import { listarUltimasCompras } from '../../services/extrato'
import { aprovarContaAluno } from '../../services/vinculos'
import { useAssincrono } from '../../hooks/useAssincrono'
import type { PerfilPortal } from '../../hooks/useSessao'
import { diaMes, mesDe } from '../../utils/datas'
import { mensagemDeErro } from '../../utils/erro'
import { primeiroNome } from '../../utils/texto'
import { Aviso, Carregando, Falha, Indicador, Modal, Vazio } from '../../components/ui'

type Mensagem = { tom: 'sucesso' | 'info' | 'erro'; texto: string }

export function Inicio({ perfil }: { perfil: PerfilPortal }) {
  const { dados, erro, recarregar } = useAssincrono(
    () => Promise.all([listarAlunos(), listarUltimasCompras(5)]),
    [],
  )
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [mensagem, setMensagem] = useState<Mensagem | null>(null)
  const [mensagemCadastro, setMensagemCadastro] = useState<Mensagem | null>(null)
  const [aprovando, setAprovando] = useState<AlunoPortal | null>(null)
  const [erroAprovacao, setErroAprovacao] = useState<string | null>(null)

  async function cadastrar(evento: FormEvent) {
    evento.preventDefault()
    setEnviando(true)
    setMensagemCadastro(null)
    try {
      const { status } = await cadastrarAluno(nome.trim(), email.trim() || undefined)
      setMensagemCadastro(
        status === 'criado'
          ? { tom: 'sucesso', texto: `${nome.trim()} foi cadastrado e já aparece na sua família.` }
          : {
              tom: 'info',
              texto:
                'Pedido de vínculo enviado. Ele passa a valer quando o aluno ou outro responsável dele aprovar.',
            },
      )
      setNome('')
      setEmail('')
      recarregar()
    } catch (e) {
      setMensagemCadastro({ tom: 'erro', texto: mensagemDeErro(e) })
    } finally {
      setEnviando(false)
    }
  }

  async function aprovar(aluno: AlunoPortal) {
    setEnviando(true)
    setErroAprovacao(null)
    try {
      await aprovarContaAluno(aluno.id)
      setAprovando(null)
      setMensagem({ tom: 'sucesso', texto: `A conta de ${aluno.nome} foi aprovada.` })
      recarregar()
    } catch (e) {
      setErroAprovacao(mensagemDeErro(e))
    } finally {
      setEnviando(false)
    }
  }

  if (!dados) return erro ? <Falha mensagem={erro} tentarDeNovo={recarregar} /> : <Carregando />
  const [alunos, compras] = dados

  return (
    <>
      <div className="page-heading">
        <h1>Olá, {primeiroNome(perfil.nome)}!</h1>
        <p className="muted">Acompanhe o consumo e os créditos dos seus filhos na cantina.</p>
      </div>
      <div className="metrics-three">
        <Indicador
          rotulo="Gasto da família neste mês"
          valor={formatarCentavos(alunos.reduce((soma, a) => soma + a.gasto_mes_centavos, 0))}
          destaque
        />
        <Indicador
          rotulo="Crédito disponível"
          valor={formatarCentavos(alunos.reduce((soma, a) => soma + Math.max(a.saldo_centavos, 0), 0))}
          destaque
        />
        <Indicador rotulo="Alunos vinculados" valor={String(alunos.length)} />
      </div>
      <Aviso>Cada aluno pode ficar devendo até R$ 250,00 na cantina. Compre créditos para evitar recusas.</Aviso>
      {mensagem && <Aviso tom={mensagem.tom}>{mensagem.texto}</Aviso>}

      <div className="family-layout">
        <section>
          <h2 className="section-title">Seus filhos</h2>
          {alunos.length ? (
            <div className="children-grid">
              {alunos.map((aluno) => (
                <article className="card child-card" key={aluno.id}>
                  <h3>{aluno.nome}</h3>
                  {aluno.email_convite && <p className="muted small">{aluno.email_convite}</p>}
                  <div className="child-details">
                    <p>
                      <span>{aluno.saldo_centavos < 0 ? 'Saldo devedor: ' : 'Saldo disponível: '}</span>
                      <strong className={aluno.saldo_centavos < 0 ? 'negative' : 'blue'}>
                        {formatarCentavos(aluno.saldo_centavos)}
                      </strong>
                    </p>
                    <p>
                      <span>Gasto no mês: </span>
                      <strong>{formatarCentavos(aluno.gasto_mes_centavos)}</strong>
                    </p>
                    <p>
                      <span>Limite mensal: </span>
                      <strong>
                        {aluno.limite_mensal_centavos === null
                          ? 'Sem limite'
                          : formatarCentavos(aluno.limite_mensal_centavos)}
                      </strong>
                    </p>
                  </div>
                  {aluno.situacao_conta === 'pendente' && (
                    <div className="pending-note">
                      <p>A conta de aluno de {primeiroNome(aluno.nome)} está esperando a sua aprovação.</p>
                      <button
                        type="button"
                        className="button primary full"
                        onClick={() => {
                          setErroAprovacao(null)
                          setAprovando(aluno)
                        }}
                      >
                        Aprovar conta
                      </button>
                    </div>
                  )}
                  {aluno.situacao_conta === 'sem_conta' && (
                    <p className="pending-note">
                      {aluno.email_convite
                        ? `Para ${primeiroNome(aluno.nome)} fazer pedidos, peça que crie uma conta de aluno com o e-mail ${aluno.email_convite} e informe o seu e-mail (${perfil.email}).`
                        : 'Cadastro sem e-mail do aluno: você acompanha o consumo, mas o aluno não consegue entrar no portal para fazer pedidos.'}
                    </p>
                  )}
                  <div className="child-actions">
                    <Link className="button primary" to={`/responsavel/alunos/${aluno.id}/extrato`}>
                      Ver extrato
                    </Link>
                    <Link className="button secondary" to={`/responsavel/alunos/${aluno.id}/limites`}>
                      Limites e créditos
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <section className="card">
              <Vazio titulo="Nenhum aluno vinculado" icone="usuarios">
                Cadastre seu filho ao lado para acompanhar o consumo dele.
              </Vazio>
            </section>
          )}
        </section>

        <aside>
          <h2 className="section-title">Cadastrar filho</h2>
          <form className="card form-stack" onSubmit={cadastrar}>
            <label>
              Nome do aluno
              <input required value={nome} onChange={(e) => setNome(e.target.value)} disabled={enviando} />
            </label>
            <label>
              E-mail do aluno (opcional)
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={enviando} />
            </label>
            <small>Com o e-mail, o aluno pode criar a própria conta e fazer pedidos depois da sua aprovação.</small>
            {mensagemCadastro && <Aviso tom={mensagemCadastro.tom}>{mensagemCadastro.texto}</Aviso>}
            <button type="submit" className="button primary full" disabled={enviando}>
              Cadastrar
            </button>
          </form>

          <h2 className="section-title spaced">Últimas compras</h2>
          <section className="card recent-list">
            {compras.length ? (
              compras.map((compra) => (
                <Link
                  className="recent-row"
                  key={compra.id}
                  to={`/responsavel/alunos/${compra.aluno_id}/extrato?mes=${mesDe(compra.criado_em)}`}
                >
                  <span className="recent-date">{diaMes(compra.criado_em)}</span>
                  <span>
                    <strong>{primeiroNome(alunos.find((a) => a.id === compra.aluno_id)?.nome ?? 'Aluno')}</strong>
                    <small>{compra.itens.map((item) => item.nome_produto).join(' + ') || compra.descricao}</small>
                  </span>
                  <b>{formatarCentavos(-compra.valor_centavos)}</b>
                </Link>
              ))
            ) : (
              <Vazio titulo="Ainda sem compras">As compras registradas aparecerão aqui.</Vazio>
            )}
          </section>
        </aside>
      </div>

      {aprovando && (
        <Modal titulo="Aprovar conta do aluno" aoFechar={() => !enviando && setAprovando(null)}>
          <p>
            Uma conta de aluno
            {aprovando.email_convite ? (
              <>
                {' '}
                com o e-mail <strong>{aprovando.email_convite}</strong>
              </>
            ) : null}{' '}
            pediu para usar o cadastro de <strong>{aprovando.nome}</strong>.
          </p>
          <Aviso>Aprove só se for mesmo a conta do seu filho: ela passa a ver o saldo e a fazer pedidos.</Aviso>
          {erroAprovacao && <Aviso tom="erro">{erroAprovacao}</Aviso>}
          <div className="button-row">
            <button type="button" className="button secondary" disabled={enviando} onClick={() => setAprovando(null)}>
              Voltar
            </button>
            <button type="button" className="button primary" disabled={enviando} onClick={() => void aprovar(aprovando)}>
              {enviando ? 'Aprovando…' : 'Aprovar'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
