import { useEffect, useState } from 'react'
import { aoMudarSessao, perfilAtual, type Perfil } from '../services/auth'

export type PerfilPortal = Perfil & { papel: 'responsavel' | 'aluno' }

type EstadoSessao = { carregando: boolean; perfil: PerfilPortal | null }

function doPortal(perfil: Perfil | null): perfil is PerfilPortal {
  return perfil?.papel === 'responsavel' || perfil?.papel === 'aluno'
}

// Perfil da conta logada. Contas da equipe usam o app de vendas; a RLS é quem de fato bloqueia.
export function useSessao(): EstadoSessao {
  const [estado, setEstado] = useState<EstadoSessao>({ carregando: true, perfil: null })

  useEffect(() => {
    let ativo = true
    const carregar = () => {
      perfilAtual()
        .then((perfil) => ativo && setEstado({ carregando: false, perfil: doPortal(perfil) ? perfil : null }))
        .catch(() => ativo && setEstado({ carregando: false, perfil: null }))
    }
    carregar()
    // Consultas dentro do callback do Auth podem travar o cliente; por isso o setTimeout.
    const parar = aoMudarSessao(() => setTimeout(carregar, 0))
    return () => {
      ativo = false
      parar()
    }
  }, [])

  return estado
}
