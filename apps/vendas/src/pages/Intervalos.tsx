import { useState, type FormEvent } from 'react'
import { atualizarIntervalo, criarIntervalo, listarIntervalos, type Intervalo } from '../services/intervalos'
import { useAssincrono } from '../hooks/useAssincrono'
import { horario } from '../utils/periodo'
import { mensagemDeErro } from '../utils/erro'
import { Aviso } from '../components/Aviso'
import { Modal } from '../components/Modal'

// Horários em que os alunos retiram pedidos antecipados.
export function Intervalos() {
  const intervalos = useAssincrono(listarIntervalos, [])
  const [editando, setEditando] = useState<Intervalo | 'novo' | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function alternar(intervalo: Intervalo) {
    setErro(null)
    try {
      await atualizarIntervalo(intervalo.id, { ativo: !intervalo.ativo })
      intervalos.recarregar()
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  return (
    <main className="pagina pagina-estreita">
      <div className="pagina-topo">
        <div>
          <h1>Intervalos de retirada</h1>
          <p className="subtitulo">Os alunos pedem até 30 minutos antes do início de cada intervalo.</p>
        </div>
        <button type="button" className="botao botao-primario" onClick={() => setEditando('novo')}>
          + Novo intervalo
        </button>
      </div>

      {(erro || intervalos.erro) && <Aviso tipo="erro">{erro ?? intervalos.erro}</Aviso>}

      <section className="cartao cartao-sem-espaco">
        <table className="tabela">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Horário</th>
              <th>Situação</th>
              <th>
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {intervalos.dados?.map((intervalo) => (
              <tr key={intervalo.id}>
                <td>
                  <strong>{intervalo.nome}</strong>
                </td>
                <td>
                  {horario(intervalo.inicio)} – {horario(intervalo.fim)}
                </td>
                <td>
                  {intervalo.ativo ? (
                    <span className="selo selo-sucesso">Ativo</span>
                  ) : (
                    <span className="selo">Desativado</span>
                  )}
                </td>
                <td className="acoes-linha">
                  <button type="button" className="botao botao-fantasma" onClick={() => setEditando(intervalo)}>
                    Editar
                  </button>
                  <button type="button" className="botao botao-fantasma" onClick={() => alternar(intervalo)}>
                    {intervalo.ativo ? 'Desativar' : 'Ativar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {intervalos.dados?.length === 0 && <p className="vazio-bloco">Nenhum intervalo cadastrado.</p>}
      </section>

      {editando && (
        <FormularioIntervalo
          intervalo={editando === 'novo' ? null : editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => {
            setEditando(null)
            intervalos.recarregar()
          }}
        />
      )}
    </main>
  )
}

function FormularioIntervalo({
  intervalo,
  aoFechar,
  aoSalvar,
}: {
  intervalo: Intervalo | null
  aoFechar: () => void
  aoSalvar: () => void
}) {
  const [nome, setNome] = useState(intervalo?.nome ?? '')
  const [inicio, setInicio] = useState(intervalo ? horario(intervalo.inicio) : '')
  const [fim, setFim] = useState(intervalo ? horario(intervalo.fim) : '')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar(evento: FormEvent) {
    evento.preventDefault()
    if (fim <= inicio) return setErro('O fim precisa ser depois do início.')
    setEnviando(true)
    setErro(null)
    try {
      const dados = { nome: nome.trim(), inicio, fim }
      if (intervalo) await atualizarIntervalo(intervalo.id, dados)
      else await criarIntervalo(dados)
      aoSalvar()
    } catch (e) {
      setErro(mensagemDeErro(e))
      setEnviando(false)
    }
  }

  return (
    <Modal titulo={intervalo ? 'Editar intervalo' : 'Novo intervalo'} aoFechar={aoFechar}>
      <form className="formulario" onSubmit={salvar}>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <label className="campo">
          <span>Nome</span>
          <input required maxLength={60} placeholder="Ex.: Recreio da manhã" value={nome} onChange={(e) => setNome(e.target.value)} />
        </label>
        <div className="linha-campos">
          <label className="campo">
            <span>Início</span>
            <input type="time" required value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </label>
          <label className="campo">
            <span>Fim</span>
            <input type="time" required value={fim} onChange={(e) => setFim(e.target.value)} />
          </label>
        </div>
        {intervalo && <small className="texto-apoio">Pedidos já feitos para este intervalo continuam valendo.</small>}
        <div className="modal-rodape">
          <button type="button" className="botao botao-secundario" onClick={aoFechar}>
            Cancelar
          </button>
          <button type="submit" className="botao botao-primario" disabled={enviando}>
            {enviando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
