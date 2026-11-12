import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest"
import { ApiError } from "../lib/api"
import { useApi } from "./useApi"

// Só o apiFetch é falso; ApiError continua o de verdade.
// Um vi.fn() novo por teste (o mockReset do Vitest 5 atrapalha o rastreio de promises rejeitadas).
let apiFetch: Mock
vi.mock("../lib/api", async (original) => ({
  ...(await original<typeof import("../lib/api")>()),
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}))

beforeEach(() => {
  apiFetch = vi.fn()
})

/**
 * Promise rejeitada já "observada". Sem isso, o Vitest acusa unhandled rejection
 * no instante em que o mock devolve a promise, antes de o hook pendurar o .catch.
 */
function rejeitar(erro: unknown): Promise<never> {
  const p = Promise.reject(erro)
  p.catch(() => {})
  return p
}

describe("useApi", () => {
  it("carrega os dados", async () => {
    apiFetch.mockResolvedValue({ total: 3 })
    const { result } = renderHook(() => useApi<{ total: number }>("/devedores/"))
    expect(result.current.carregando).toBe(true)
    await waitFor(() => expect(result.current.dados).toEqual({ total: 3 }))
    expect(result.current.carregando).toBe(false)
    expect(result.current.erro).toBeNull()
    expect(result.current.atualizadoEm).toBeInstanceOf(Date)
  })

  it("expõe a mensagem do ApiError", async () => {
    apiFetch.mockImplementation(() => rejeitar(new ApiError(403, "Você não tem permissão para esta ação.")))
    const { result } = renderHook(() => useApi("/auditoria/"))
    await waitFor(() => expect(result.current.erro).toBe("Você não tem permissão para esta ação."))
    expect(result.current.carregando).toBe(false)
  })

  it("não busca nada com path null", () => {
    const { result } = renderHook(() => useApi(null))
    expect(apiFetch).not.toHaveBeenCalled()
    expect(result.current.carregando).toBe(false)
  })

  it("busca de novo quando o path muda (filtros na query string)", async () => {
    apiFetch.mockResolvedValue({})
    const { rerender } = renderHook(({ path }) => useApi(path), { initialProps: { path: "/devedores/?status=ativo" } })
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1))
    rerender({ path: "/devedores/?status=quitado" })
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2))
    expect(apiFetch.mock.calls[1][0]).toBe("/devedores/?status=quitado")
  })

  it("faz polling e para quando pararQuando devolve true", async () => {
    vi.useFakeTimers()
    apiFetch
      .mockResolvedValueOnce({ status: "processando" })
      .mockResolvedValueOnce({ status: "processando" })
      .mockResolvedValue({ status: "concluido" })

    const { result } = renderHook(() =>
      useApi<{ status: string }>("/lotes/1", { intervaloMs: 1000, pararQuando: (l) => l.status === "concluido" }),
    )
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(result.current.dados?.status).toBe("processando")

    await act(() => vi.advanceTimersByTimeAsync(1000))
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(result.current.dados?.status).toBe("concluido")
    const chamadasAteConcluir = apiFetch.mock.calls.length

    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(apiFetch).toHaveBeenCalledTimes(chamadasAteConcluir) // parou
  })

  it("recarregar() busca de novo sem apagar os dados atuais", async () => {
    apiFetch.mockResolvedValueOnce({ v: 1 }).mockResolvedValueOnce({ v: 2 })
    const { result } = renderHook(() => useApi<{ v: number }>("/x"))
    await waitFor(() => expect(result.current.dados).toEqual({ v: 1 }))
    act(() => result.current.recarregar())
    expect(result.current.dados).toEqual({ v: 1 }) // sem "piscar"
    await waitFor(() => expect(result.current.dados).toEqual({ v: 2 }))
  })
})
