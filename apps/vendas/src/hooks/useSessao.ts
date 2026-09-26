import { useEffect, useState } from 'react'
import { aoMudarSessao, perfilAtual, type Perfil } from '../services/auth'

type EstadoSessao = { carregando: boolean; perfil: Perfil | null }

// Perfil da conta logada. Só contas da equipe entram no app; a RLS é quem de fato bloqueia.
export function useSessao(): EstadoSessao {
  const [estado, setEstado] = useState<EstadoSessao>({ carregando: true, perfil: null })

  useEffect(() => {
    let ativo = true
    const carregar = () => {
      perfilAtual()
        .then((perfil) => ativo && setEstado({ carregando: false, perfil: perfil?.papel === 'equipe' ? perfil : null }))
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
