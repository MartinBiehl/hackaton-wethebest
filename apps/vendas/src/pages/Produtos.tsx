import { useState, type FormEvent } from 'react'
import { formatarCentavos, reaisParaCentavos } from '@wethebest/shared'
import {
  atualizarProduto,
  criarProduto,
  definirEstoque,
  enviarFoto,
  listarProdutos,
  removerFoto,
  urlFoto,
  type Produto,
} from '../services/produtos'
import { useAssincrono } from '../hooks/useAssincrono'
import { mensagemDeErro } from '../utils/erro'
import { Aviso } from '../components/Aviso'
import { Modal } from '../components/Modal'
import { CampoBusca } from '../components/CampoBusca'
import { IconeImagem } from '../components/Icones'

export function Produtos() {
  const produtos = useAssincrono(() => listarProdutos(true), [])
  const [texto, setTexto] = useState('')
  const [editando, setEditando] = useState<Produto | 'novo' | null>(null)
  const [estoques, setEstoques] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const palavras = texto.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const visiveis = (produtos.dados ?? []).filter((p) => palavras.every((palavra) => p.nome.toLowerCase().includes(palavra)))

  async function salvarEstoque(produto: Produto) {
    const quantidade = Number(estoques[produto.id])
    if (!Number.isInteger(quantidade) || quantidade < 0) {
      setErro('Informe uma quantidade inteira, zero ou maior.')
      return
    }
    setErro(null)
    try {
      await definirEstoque(produto.id, quantidade)
      setEstoques((atual) => {
        const resto = { ...atual }
        delete resto[produto.id]
        return resto
      })
      setAviso(`Estoque de ${produto.nome} atualizado para ${quantidade}.`)
      produtos.recarregar()
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  return (
    <main className="pagina">
      <div className="pagina-topo">
        <div>
          <h1>Produtos e estoque</h1>
          <p className="subtitulo">Cardápio mostrado no balcão e no portal dos alunos.</p>
        </div>
        <button type="button" className="botao botao-primario" onClick={() => setEditando('novo')}>
          + Novo produto
        </button>
      </div>

      <CampoBusca valor={texto} aoMudar={setTexto} placeholder="Pesquisar produto pelo nome..." />
      {aviso && <Aviso tipo="sucesso">{aviso}</Aviso>}
      {(erro || produtos.erro) && <Aviso tipo="erro">{erro ?? produtos.erro}</Aviso>}

      <section className="cartao cartao-sem-espaco">
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead>
              <tr>
                <th>
                  <span className="sr-only">Foto</span>
                </th>
                <th>Produto</th>
                <th className="numero">Preço</th>
                <th>Estoque</th>
                <th>Situação</th>
                <th>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((produto) => {
                const foto = urlFoto(produto.foto_path)
                const rascunho = estoques[produto.id]
                return (
                  <tr key={produto.id}>
                    <td>
                      {foto ? (
                        <img className="miniatura" src={foto} alt="" loading="lazy" />
                      ) : (
                        <span className="miniatura miniatura-vazia">
                          <IconeImagem />
                        </span>
                      )}
                    </td>
                    <td>
                      <strong>{produto.nome}</strong>
                      {produto.descricao && <div className="texto-apoio">{produto.descricao}</div>}
                    </td>
                    <td className="numero">{formatarCentavos(produto.preco_centavos)}</td>
                    <td>
                      <form
                        style={{ display: 'flex', gap: 6, alignItems: 'center' }}
                        onSubmit={(e) => {
                          e.preventDefault()
                          salvarEstoque(produto)
                        }}
                      >
                        <input
                          className="entrada"
                          type="number"
                          min={0}
                          step={1}
                          style={{ width: 90 }}
                          aria-label={`Estoque de ${produto.nome}`}
                          value={rascunho ?? produto.estoque}
                          onChange={(e) => setEstoques((atual) => ({ ...atual, [produto.id]: e.target.value }))}
                        />
                        {rascunho !== undefined && rascunho !== String(produto.estoque) && (
                          <button type="submit" className="botao botao-fantasma">
                            Salvar
                          </button>
                        )}
                      </form>
                    </td>
                    <td>
                      {produto.ativo ? (
                        <span className="selo selo-sucesso">À venda</span>
                      ) : (
                        <span className="selo">Fora de venda</span>
                      )}
                    </td>
                    <td className="acoes-linha">
                      <button type="button" className="botao botao-fantasma" onClick={() => setEditando(produto)}>
                        Editar
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {produtos.dados && visiveis.length === 0 && <p className="vazio-bloco">Nenhum produto encontrado.</p>}
        </div>
      </section>

      {editando && (
        <FormularioProduto
          produto={editando === 'novo' ? null : editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={(mensagem) => {
            setEditando(null)
            setAviso(mensagem)
            produtos.recarregar()
          }}
        />
      )}
    </main>
  )
}

function FormularioProduto({
  produto,
  aoFechar,
  aoSalvar,
}: {
  produto: Produto | null
  aoFechar: () => void
  aoSalvar: (mensagem: string) => void
}) {
  const [nome, setNome] = useState(produto?.nome ?? '')
  const [descricao, setDescricao] = useState(produto?.descricao ?? '')
  const [preco, setPreco] = useState(produto ? (produto.preco_centavos / 100).toFixed(2).replace('.', ',') : '')
  const [ativo, setAtivo] = useState(produto?.ativo ?? true)
  const [foto, setFoto] = useState<File | null>(null)
  const [tirarFoto, setTirarFoto] = useState(false)
  // Produto novo já criado numa tentativa anterior em que só a foto falhou.
  const [criadoId, setCriadoId] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const fotoAtual = produto && !tirarFoto ? urlFoto(produto.foto_path) : null

  async function salvar(evento: FormEvent) {
    evento.preventDefault()
    const precoCentavos = reaisParaCentavos(preco)
    if (!nome.trim()) return setErro('Informe o nome do produto.')
    if (precoCentavos === null || precoCentavos <= 0) return setErro('Informe um preço válido, por exemplo 7,50.')

    setEnviando(true)
    setErro(null)
    let id = produto?.id ?? criadoId
    try {
      const dados = { nome: nome.trim(), descricao: descricao.trim() || null, preco_centavos: precoCentavos, ativo }
      if (id) await atualizarProduto(id, dados)
      else {
        id = await criarProduto(dados)
        setCriadoId(id)
      }

      if (foto) await enviarFoto(id, foto)
      else if (tirarFoto && produto?.foto_path) await removerFoto(id, produto.foto_path)

      aoSalvar(produto ? `${dados.nome} atualizado.` : `${dados.nome} cadastrado. Lembre de informar o estoque.`)
    } catch (e) {
      // Se o produto novo foi criado e só a foto falhou, ele já existe: não criar de novo.
      setErro(id && !produto ? `Produto criado, mas a foto não foi enviada: ${mensagemDeErro(e)}` : mensagemDeErro(e))
      setEnviando(false)
    }
  }

  return (
    <Modal titulo={produto ? 'Editar produto' : 'Novo produto'} aoFechar={aoFechar}>
      <form className="formulario" onSubmit={salvar}>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <label className="campo">
          <span>Nome</span>
          <input required maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} />
        </label>
        <label className="campo">
          <span>Descrição (opcional)</span>
          <textarea maxLength={300} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </label>
        <label className="campo">
          <span>Preço (R$)</span>
          <input inputMode="decimal" placeholder="0,00" required value={preco} onChange={(e) => setPreco(e.target.value)} />
        </label>
        <label className="campo-check">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
          À venda (aparece no balcão e no portal)
        </label>
        <div className="campo">
          <span>Foto</span>
          {fotoAtual && !foto && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img className="miniatura" src={fotoAtual} alt={`Foto atual de ${produto?.nome}`} />
              <button type="button" className="botao botao-fantasma perigo" onClick={() => setTirarFoto(true)}>
                Remover foto
              </button>
            </div>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
          />
          <small>JPEG, PNG ou WebP, até 5 MB.</small>
        </div>
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
