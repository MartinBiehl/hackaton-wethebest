import { useEffect, useState } from 'react'
import { buscarAlunos, type AlunoResumo } from '../services/alunos'
import { useAtrasado } from '../hooks/useAtrasado'
import { IconeUsuario } from './Icones'

type Props = {
  aoSelecionar: (aluno: AlunoResumo) => void
  placeholder?: string
  autoFocus?: boolean
}

// Busca por nome e sobrenome em qualquer ordem (regra do serviço buscarAlunos).
export function BuscaAluno({ aoSelecionar, placeholder = 'Pesquisar aluno pelo nome...', autoFocus }: Props) {
  const [texto, setTexto] = useState('')
  const termo = useAtrasado(texto.trim())
  const [resultado, setResultado] = useState<{ termo: string; alunos: AlunoResumo[]; erro: boolean } | null>(null)
  const [aberto, setAberto] = useState(false)

  useEffect(() => {
    if (!termo) return
    let ativo = true
    buscarAlunos(termo, 10).then(
      (alunos) => ativo && setResultado({ termo, alunos, erro: false }),
      () => ativo && setResultado({ termo, alunos: [], erro: true }),
    )
    return () => {
      ativo = false
    }
  }, [termo])

  const atual = termo && resultado?.termo === termo ? resultado : null

  function escolher(aluno: AlunoResumo) {
    aoSelecionar(aluno)
    setTexto('')
    setAberto(false)
  }

  return (
    <div className="busca" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setAberto(false)}>
      <IconeUsuario />
      <input
        type="search"
        aria-label="Pesquisar aluno"
        value={texto}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => {
          setTexto(e.target.value)
          setAberto(true)
        }}
        onFocus={() => setAberto(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && atual?.alunos.length === 1) {
            e.preventDefault()
            escolher(atual.alunos[0])
          }
        }}
      />
      {aberto && texto.trim() && (
        <ul className="busca-resultados">
          {!atual && <li className="vazio">Buscando...</li>}
          {atual?.erro && <li className="vazio">Não foi possível buscar. Tente de novo.</li>}
          {atual && !atual.erro && atual.alunos.length === 0 && <li className="vazio">Nenhum aluno encontrado.</li>}
          {atual?.alunos.map((aluno) => (
            <li key={aluno.id}>
              <button type="button" onClick={() => escolher(aluno)}>
                {aluno.nome}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
