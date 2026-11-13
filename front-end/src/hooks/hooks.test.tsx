import { act, fireEvent, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useDebounce } from "./useDebounce"
import { useFecharComEsc } from "./useFecharComEsc"
import { dependenciasFora, useSaude } from "./useSaude"

describe("useDebounce", () => {
  it("só entrega o valor depois do atraso sem mudanças", () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 400), { initialProps: { v: "a" } })
    rerender({ v: "an" })
    rerender({ v: "ana" })
    act(() => vi.advanceTimersByTime(399))
    expect(result.current).toBe("a")
    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe("ana")
  })
})

describe("useFecharComEsc", () => {
  it("chama onFechar no Esc, só quando ativo", () => {
    const onFechar = vi.fn()
    const { rerender } = renderHook(({ ativo }) => useFecharComEsc(onFechar, ativo), { initialProps: { ativo: true } })
    fireEvent.keyDown(window, { key: "Enter" })
    fireEvent.keyDown(window, { key: "Escape" })
    expect(onFechar).toHaveBeenCalledOnce()

    rerender({ ativo: false }) // ex.: modal ocupado salvando
    fireEvent.keyDown(window, { key: "Escape" })
    expect(onFechar).toHaveBeenCalledOnce()
  })
})

describe("useSaude", () => {
  it("consulta o /health e repete no intervalo", async () => {
    vi.useFakeTimers()
    const corpo = { status: "degradado", dependencias: { postgres: true, redis: false, rabbitmq: true } }
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(corpo), { status: 503 }))
    vi.stubGlobal("fetch", fetchMock)

    const { result } = renderHook(() => useSaude(30_000))
    expect(result.current.saude).toBeUndefined() // verificando
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(result.current.saude).toEqual(corpo)
    expect(dependenciasFora(result.current.saude)).toEqual(["redis"])

    await act(() => vi.advanceTimersByTimeAsync(30_000))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("dependenciasFora é vazio sem resposta da API", () => {
    expect(dependenciasFora(null)).toEqual([])
    expect(dependenciasFora(undefined)).toEqual([])
  })
})
