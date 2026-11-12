import { useEffect, useState } from "react"

/** Devolve `valor` só depois de `atrasoMs` sem mudanças (ex.: busca enquanto digita). */
export function useDebounce<T>(valor: T, atrasoMs = 400): T {
  const [atrasado, setAtrasado] = useState(valor)
  useEffect(() => {
    const id = window.setTimeout(() => setAtrasado(valor), atrasoMs)
    return () => window.clearTimeout(id)
  }, [valor, atrasoMs])
  return atrasado
}
