import { useState, type FormEvent } from 'react'
import { formatarCentavos, reaisParaCentavos } from '@wethebest/shared'
import { cadastrarAluno, listarAlunosComSaldo, registrarPagamento, type AlunoComSaldo } from '../services/alunos'
import { useAssincrono } from '../hooks/useAssincrono'
import { useAtrasado } from '../hooks/useAtrasado'
import { mensagemDeErro } from '../utils/erro'
import { Aviso } from '../components/Aviso'
import { Modal } from '../components/Modal'
import { CampoBusca } from '../components/CampoBusca'

export function Alunos() {
  const [texto, setTexto] = useState('')
  const termo = useAtrasado(texto)
  const alunos = useAssincrono(() => listarAlunosComSaldo(termo), [termo])
  const [novo, setNovo] = useState(false)
  const [recebendo, setRecebendo] = useState<AlunoComSaldo | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  function concluir(mensagem: string) {
    setNovo(false)
    setRecebendo(null)
    setAviso(mensagem)
    alunos.recarregar()
  }

  return (
    <main className="pagina">
      <div className="pagina-topo">
        <div>
          <h1>Alunos</h1>
          <p className="subtitulo">Saldo de cada aluno. Negativo é fiado em aberto.</p>
        </div>
        <button type="button" className="botao botao-primario" onClick={() => setNovo(true)}>
          + Novo aluno
        </button>
      </div>

      <CampoBusca valor={texto} aoMudar={setTexto} placeholder="Pesquisar aluno pelo nome..." />
      {aviso && <Aviso tipo="sucesso">{aviso}</Aviso>}
      {alunos.erro && <Aviso tipo="erro">{alunos.erro}</Aviso>}

      <section className="cartao cartao-sem-espaco">
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Conta no portal</th>
                <th className="numero">Saldo</th>
                <th>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {alunos.dados?.map((aluno) => (
                <tr key={aluno.id}>
                  <td>
                    <strong>{aluno.nome}</strong>
                  </td>
                  <td className="texto-apoio">{aluno.email_convite ?? '—'}</td>
                  <td>
                    {aluno.tem_conta ? (
                      <span className="selo selo-sucesso">Ativa</span>
                    ) : (
                      <span className="selo">Sem conta</span>
                    )}
                  </td>
                  <td className={`numero ${aluno.saldo_centavos < 0 ? 'negativo' : ''}`}>
                    <strong>{formatarCentavos(aluno.saldo_centavos)}</strong>
                  </td>
                  <td className="acoes-linha">
                    {aluno.saldo_centavos < 0 && (
                      <button type="button" className="botao botao-fantasma" onClick={() => setRecebendo(aluno)}>
                        Receber fiado
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {alunos.dados?.length === 0 && <p className="vazio-bloco">Nenhum aluno encontrado.</p>}
        </div>
      </section>

      {novo && <NovoAluno aoFechar={() => setNovo(false)} aoSalvar={concluir} />}
      {recebendo && <ReceberFiado aluno={recebendo} aoFechar={() => setRecebendo(null)} aoSalvar={concluir} />}
    </main>
  )
}

type PropsModal = { aoFechar: () => void; aoSalvar: (mensagem: string) => void }

// A equipe cadastra o aluno sem responsável; o vínculo é feito depois pelo portal.
function NovoAluno({ aoFechar, aoSalvar }: PropsModal) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar(evento: FormEvent) {
    evento.preventDefault()
    setEnviando(true)
    setErro(null)
    try {
      await cadastrarAluno(nome.trim(), email.trim() || undefined)
      aoSalvar(`${nome.trim()} cadastrado.`)
    } catch (e) {
      setErro(mensagemDeErro(e))
      setEnviando(false)
    }
  }

  return (
    <Modal titulo="Novo aluno" aoFechar={aoFechar}>
      <form className="formulario" onSubmit={salvar}>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <label className="campo">
          <span>Nome completo</span>
          <input required maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
        </label>
        <label className="campo">
          <span>E-mail do aluno (opcional)</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <small>Usado para ligar o cadastro à conta do aluno no portal.</small>
        </label>
        <div className="modal-rodape">
          <button type="button" className="botao botao-secundario" onClick={aoFechar}>
            Cancelar
          </button>
          <button type="submit" className="botao botao-primario" disabled={enviando || !nome.trim()}>
            {enviando ? 'Salvando...' : 'Cadastrar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// Quitação de fiado paga no balcão: entra como pagamento no extrato do aluno.
function ReceberFiado({ aluno, aoFechar, aoSalvar }: PropsModal & { aluno: AlunoComSaldo }) {
  const divida = -aluno.saldo_centavos
  const [valor, setValor] = useState((divida / 100).toFixed(2).replace('.', ','))
  const [descricao, setDescricao] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar(evento: FormEvent) {
    evento.preventDefault()
    const centavos = reaisParaCentavos(valor)
    if (centavos === null || centavos <= 0) return setErro('Informe um valor válido, por exemplo 20,00.')
    setEnviando(true)
    setErro(null)
    try {
      await registrarPagamento(aluno.id, centavos, descricao.trim() || undefined)
      aoSalvar(`Recebido ${formatarCentavos(centavos)} de ${aluno.nome}.`)
    } catch (e) {
      setErro(mensagemDeErro(e))
      setEnviando(false)
    }
  }

  return (
    <Modal titulo="Receber fiado" aoFechar={aoFechar}>
      <form className="formulario" onSubmit={salvar}>
        <p>
          <strong>{aluno.nome}</strong> deve <strong className="negativo">{formatarCentavos(divida)}</strong>.
        </p>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <label className="campo">
          <span>Valor recebido (R$)</span>
          <input inputMode="decimal" required value={valor} onChange={(e) => setValor(e.target.value)} />
          <small>Se pagar mais que a dívida, o excedente fica como crédito.</small>
        </label>
        <label className="campo">
          <span>Observação (opcional)</span>
          <input maxLength={200} placeholder="Ex.: dinheiro, Pix para a Carla" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </label>
        <div className="modal-rodape">
          <button type="button" className="botao botao-secundario" onClick={aoFechar}>
            Cancelar
          </button>
          <button type="submit" className="botao botao-primario" disabled={enviando}>
            {enviando ? 'Registrando...' : 'Registrar pagamento'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
