import { act, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest"
import { ApiError } from "../lib/api"
import type { Usuario } from "../lib/tipos"
import { AuthProvider, useAuth } from "./AuthContext"

// Um vi.fn() novo por teste (o mockReset do Vitest 5 atrapalha o rastreio de promises rejeitadas)
let apiFetch: Mock
let aoExpirar: (() => void) | null = null
vi.mock("../lib/api", async (original) => ({
  ...(await original<typeof import("../lib/api")>()),
  apiFetch: (...args: unknown[]) => apiFetch(...args),
  definirAoExpirarSessao: (cb: (() => void) | null) => {
    aoExpirar = cb
  },
}))

const GESTOR: Usuario = { id: "1", nome: "Gestora", email: "g@x.com", perfil: "gestor" }
const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>

beforeEach(() => {
  apiFetch = vi.fn()
  aoExpirar = null
})

describe("AuthContext", () => {
  it("restaura a sessão com GET /auth/me (F5 mantém o login)", async () => {
    apiFetch.mockResolvedValueOnce(GESTOR)
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.carregando).toBe(true)
    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(apiFetch).toHaveBeenCalledWith("/auth/me")
    expect(result.current.usuario).toEqual(GESTOR)
  })

  it("sem sessão, fica deslogado sem mostrar 'sessão expirada'", async () => {
    apiFetch.mockRejectedValueOnce(new ApiError(401, "Sua sessão expirou."))
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.carregando).toBe(false))
    act(() => aoExpirar?.()) // o refresh falhou na primeira visita
    expect(result.current.usuario).toBeNull()
    expect(result.current.sessaoExpirada).toBe(false)
  })

  it("login e logout", async () => {
    apiFetch.mockRejectedValueOnce(new ApiError(401, "")) // /auth/me
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.carregando).toBe(false))

    apiFetch.mockResolvedValueOnce({ message: "ok", user: GESTOR })
    await act(() => result.current.login("g@x.com", "Senha123"))
    expect(apiFetch).toHaveBeenLastCalledWith("/auth/login", { method: "POST", body: { email: "g@x.com", password: "Senha123" } })
    expect(result.current.usuario).toEqual(GESTOR)

    apiFetch.mockResolvedValueOnce(undefined)
    await act(() => result.current.logout())
    expect(apiFetch).toHaveBeenLastCalledWith("/auth/logout", { method: "DELETE" })
    expect(result.current.usuario).toBeNull()
  })

  it("logout limpa a sessão na tela mesmo se a API falhar", async () => {
    apiFetch.mockResolvedValueOnce(GESTOR)
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.usuario).toEqual(GESTOR))
    apiFetch.mockRejectedValueOnce(new ApiError(0, "fora do ar"))
    await act(() => result.current.logout())
    expect(result.current.usuario).toBeNull()
  })

  it("avisa 'sessão expirada' quando a renovação falha com alguém logado", async () => {
    apiFetch.mockResolvedValueOnce(GESTOR)
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.usuario).toEqual(GESTOR))
    act(() => aoExpirar?.())
    expect(result.current.usuario).toBeNull()
    expect(result.current.sessaoExpirada).toBe(true)
  })

  it("pode() aplica o RBAC na interface", async () => {
    apiFetch.mockResolvedValueOnce(GESTOR)
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.usuario).not.toBeNull())
    expect(result.current.pode(["administrador", "gestor"])).toBe(true)
    expect(result.current.pode(["administrador"])).toBe(false)
  })

  it("useAuth fora do provider é erro de programação", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => renderHook(() => useAuth())).toThrow("AuthProvider")
  })
})
