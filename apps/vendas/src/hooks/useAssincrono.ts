import { useCallback, useEffect, useRef, useState } from 'react'
import { mensagemDeErro } from '../utils/erro'

type Estado<T> = { chave: string | null; dados: T | null; erro: string | null }

// Carrega dados de um serviço e recarrega quando as dependências (valores
// serializáveis) mudam. Ao recarregar, os dados anteriores continuam na tela.
export function useAssincrono<T>(carregar: () => Promise<T>, dependencias: unknown[]) {
  const [versao, setVersao] = useState(0)
  const chave = JSON.stringify([dependencias, versao])
  const [estado, setEstado] = useState<Estado<T>>({ chave: null, dados: null, erro: null })

  // A função muda a cada render; a chave é quem decide quando buscar de novo.
  const carregarAtual = useRef(carregar)
  useEffect(() => {
    carregarAtual.current = carregar
  })

  useEffect(() => {
    let ativo = true
    carregarAtual.current().then(
      (dados) => ativo && setEstado({ chave, dados, erro: null }),
      (erro) => ativo && setEstado((anterior) => ({ chave, dados: anterior.dados, erro: mensagemDeErro(erro) })),
    )
    return () => {
      ativo = false
    }
  }, [chave])

  const recarregar = useCallback(() => setVersao((v) => v + 1), [])
  return { dados: estado.dados, erro: estado.erro, carregando: estado.chave !== chave, recarregar }
}
