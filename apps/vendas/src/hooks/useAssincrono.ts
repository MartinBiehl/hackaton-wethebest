import { useCallback, useEffect, useRef, useState } from 'react'
import { mensagemDeErro } from '../utils/erro'

type Estado<T> = { chave: string | null; dados: T | null; erro: string | null }

// Carrega dados de um serviço e recarrega quando as dependências (valores
// serializáveis) mudam. Ao recarregar, os dados anteriores continuam na tela.
// Com atualizarACadaMs, busca de novo sozinho enquanto a aba está visível e ao
// voltar para ela, sem marcar a tela como carregando: é assim que aparece o que
// outra conta mudou (um pedido novo, um Pix confirmado) sem clicar em "Atualizar".
export function useAssincrono<T>(carregar: () => Promise<T>, dependencias: unknown[], atualizarACadaMs?: number) {
  const [versao, setVersao] = useState(0)
  const [atualizacao, setAtualizacao] = useState(0)
  const chave = JSON.stringify([dependencias, versao])
  const [estado, setEstado] = useState<Estado<T>>({ chave: null, dados: null, erro: null })

  // A função muda a cada render; a chave é quem decide quando buscar de novo.
  const carregarAtual = useRef(carregar)
  useEffect(() => {
    carregarAtual.current = carregar
  })

  // Com a rede lenta, a atualização automática espera a busca anterior terminar
  // em vez de cancelá-la e nunca chegar a mostrar nada.
  const buscando = useRef(false)
  useEffect(() => {
    let ativo = true
    buscando.current = true
    carregarAtual.current().then(
      (dados) => {
        if (!ativo) return
        buscando.current = false
        setEstado({ chave, dados, erro: null })
      },
      (erro) => {
        if (!ativo) return
        buscando.current = false
        setEstado((anterior) => ({ chave, dados: anterior.dados, erro: mensagemDeErro(erro) }))
      },
    )
    return () => {
      ativo = false
    }
  }, [chave, atualizacao])

  useEffect(() => {
    if (!atualizarACadaMs) return
    const atualizar = () => {
      if (document.visibilityState === 'visible' && !buscando.current) setAtualizacao((n) => n + 1)
    }
    const id = window.setInterval(atualizar, atualizarACadaMs)
    document.addEventListener('visibilitychange', atualizar)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', atualizar)
    }
  }, [atualizarACadaMs])

  const recarregar = useCallback(() => setVersao((v) => v + 1), [])
  return { dados: estado.dados, erro: estado.erro, carregando: estado.chave !== chave, recarregar }
}
