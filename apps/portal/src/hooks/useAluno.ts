import { useOutletContext } from 'react-router-dom'
import type { AlunoPortal } from '../services/alunos'

export type ContextoAluno = { aluno: AlunoPortal; recarregarAluno: () => void }

// Registro do aluno logado, carregado pela AreaAluno para todas as telas dele.
export function useAluno(): ContextoAluno {
  return useOutletContext<ContextoAluno>()
}
