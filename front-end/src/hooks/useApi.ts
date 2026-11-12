import { useCallback, useEffect, useRef, useState } from "react"
import { ApiError, apiFetch } from "../lib/api"

interface OpcoesUseApi<T> {
  /** Recarrega sozinho a cada N ms (sem piscar a tela: mantém os dados atuais). */
  intervaloMs?: number
  /** Para o recarregamento automático quando devolver true (ex.: lote concluído). */
  pararQuando?: (dados: T) => boolean
}

export interface ResultadoApi<T> {
  dados: T | null
  /** Mensagem pronta para a tela, ou null. */
  erro: string | null
  /** true só na primeira carga (ou quando o path muda); recargas não zeram os dados. */
  carregando: boolean
  /** Momento da última resposta com sucesso. */
  atualizadoEm: Date | null
  recarregar: () => void
}

/**
 * GET em `path` com estados de carregamento/erro. Recarrega quando o `path` muda
 * (por isso, coloque filtros na query string) e, se pedido, em intervalos.
 * Passe `null` para não buscar nada.
 */
export function useApi<T>(path: string | null, { intervaloMs, pararQuando }: OpcoesUseApi<T> = {}): ResultadoApi<T> {
  const [dados, setDados] = useState<T | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(path !== null)
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null)
  const [versao, setVersao] = useState(0)
  const pathAnterior = useRef<string | null>(null)

  const recarregar = useCallback(() => setVersao((v) => v + 1), [])

  useEffect(() => {
    if (path === null) return
    const controle = new AbortController()

    // Path novo (ex.: outro filtro): mostra carregando. Mesma consulta: recarga silenciosa.
    if (pathAnterior.current !== path) {
      pathAnterior.current = path
      setCarregando(true)
    }

    apiFetch<T>(path, { signal: controle.signal })
      .then((resposta) => {
        setDados(resposta)
        setErro(null)
        setAtualizadoEm(new Date())
      })
      .catch((e: unknown) => {
        if (controle.signal.aborted) return
        setErro(e instanceof ApiError ? e.message : "Erro inesperado ao carregar os dados.")
      })
      .finally(() => {
        if (!controle.signal.aborted) setCarregando(false)
      })

    return () => controle.abort()
  }, [path, versao])

  // Calculado a cada renderização; o efeito só depende do booleano (a função pode mudar sempre).
  const parado = dados !== null && pararQuando !== undefined && pararQuando(dados)

  useEffect(() => {
    if (!intervaloMs || path === null || parado) return
    const id = window.setInterval(recarregar, intervaloMs)
    return () => window.clearInterval(id)
  }, [intervaloMs, path, recarregar, parado])

  return { dados, erro, carregando, atualizadoEm, recarregar }
}
