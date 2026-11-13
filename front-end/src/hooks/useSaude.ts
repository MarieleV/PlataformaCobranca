import { useEffect, useState } from "react"
import { consultarSaude } from "../lib/api"
import type { Saude } from "../lib/tipos"

/**
 * GET /health em intervalos. `undefined` = ainda consultando;
 * `null` = a API não respondeu; senão, o status de cada dependência.
 */
export function useSaude(intervaloMs = 60_000): { saude: Saude | null | undefined; verificadoEm: Date | null } {
  const [saude, setSaude] = useState<Saude | null | undefined>(undefined)
  const [verificadoEm, setVerificadoEm] = useState<Date | null>(null)

  useEffect(() => {
    let controle = new AbortController()
    const consultar = () => {
      controle.abort()
      controle = new AbortController()
      consultarSaude(controle.signal)
        .then((s) => {
          setSaude(s)
          setVerificadoEm(new Date())
        })
        .catch(() => {}) // abortado
    }
    consultar()
    const id = window.setInterval(consultar, intervaloMs)
    return () => {
      window.clearInterval(id)
      controle.abort()
    }
  }, [intervaloMs])

  return { saude, verificadoEm }
}

export const NOME_DEPENDENCIA: Record<keyof Saude["dependencias"], string> = {
  postgres: "Banco de dados (PostgreSQL)",
  redis: "Sessões e cache (Redis)",
  rabbitmq: "Fila de tarefas (RabbitMQ)",
}

/** Dependências fora do ar (vazio se tudo ok ou se a API nem respondeu). */
export function dependenciasFora(saude: Saude | null | undefined): (keyof Saude["dependencias"])[] {
  if (!saude) return []
  return (Object.keys(saude.dependencias) as (keyof Saude["dependencias"])[]).filter((d) => !saude.dependencias[d])
}
