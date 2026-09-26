import { useEffect, useState } from 'react'

// Valor que só muda depois de uma pausa na digitação.
export function useAtrasado<T>(valor: T, atrasoMs = 250): T {
  const [atrasado, setAtrasado] = useState(valor)
  useEffect(() => {
    const id = setTimeout(() => setAtrasado(valor), atrasoMs)
    return () => clearTimeout(id)
  }, [valor, atrasoMs])
  return atrasado
}
