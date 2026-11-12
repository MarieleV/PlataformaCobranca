import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { API_URL, ApiError, apiFetch, consultarSaude, definirAoExpirarSessao } from "./api"

/** Resposta falsa do fetch. */
function resposta(status: number, corpo?: unknown): Response {
  return new Response(corpo === undefined ? null : JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  definirAoExpirarSessao(null)
})

/** URLs chamadas, na ordem (sem o API_URL). */
const chamadas = () => fetchMock.mock.calls.map(([url]) => String(url).replace(API_URL, ""))

describe("apiFetch", () => {
  it("envia os cookies (credentials: include) e devolve o JSON", async () => {
    fetchMock.mockResolvedValueOnce(resposta(200, { ok: 1 }))
    await expect(apiFetch("/dashboard/")).resolves.toEqual({ ok: 1 })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${API_URL}/dashboard/`)
    expect(init.credentials).toBe("include")
  })

  it("manda objeto como JSON e FormData sem Content-Type (o navegador põe o boundary)", async () => {
    fetchMock.mockImplementation(async () => resposta(200, {})) // uma Response nova por chamada
    await apiFetch("/x", { method: "POST", body: { a: 1 } })
    expect(fetchMock.mock.calls[0][1].headers["Content-Type"]).toBe("application/json")
    expect(fetchMock.mock.calls[0][1].body).toBe('{"a":1}')

    const form = new FormData()
    await apiFetch("/lotes/upload", { method: "POST", body: form })
    expect(fetchMock.mock.calls[1][1].headers["Content-Type"]).toBeUndefined()
    expect(fetchMock.mock.calls[1][1].body).toBe(form)
  })

  it("devolve undefined em 204", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await expect(apiFetch("/devedores/1", { method: "DELETE" })).resolves.toBeUndefined()
  })

  it("em 401 renova a sessão uma vez e repete a requisição", async () => {
    fetchMock
      .mockResolvedValueOnce(resposta(401, { detail: "Não autenticado" }))
      .mockResolvedValueOnce(resposta(200, { message: "Sessão renovada" })) // /auth/refresh
      .mockResolvedValueOnce(resposta(200, { id: 1 }))
    await expect(apiFetch("/auth/me")).resolves.toEqual({ id: 1 })
    expect(chamadas()).toEqual(["/auth/me", "/auth/refresh", "/auth/me"])
  })

  it("se o refresh falhar, avisa que a sessão expirou e lança 401", async () => {
    const expirou = vi.fn()
    definirAoExpirarSessao(expirou)
    fetchMock
      .mockResolvedValueOnce(resposta(401))
      .mockResolvedValueOnce(resposta(401, { detail: "Sessão expirada" })) // refresh recusado
    await expect(apiFetch("/devedores/")).rejects.toMatchObject({ status: 401 })
    expect(expirou).toHaveBeenCalledOnce()
    expect(chamadas()).toEqual(["/devedores/", "/auth/refresh"])
  })

  it("várias requisições com 401 ao mesmo tempo usam UM único refresh (rotação do token)", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/auth/refresh")) return resposta(200, {})
      const jaRenovou = fetchMock.mock.calls.some(([u]) => String(u).endsWith("/auth/refresh"))
      return jaRenovou ? resposta(200, { ok: true }) : resposta(401)
    })
    await Promise.all([apiFetch("/a"), apiFetch("/b"), apiFetch("/c")])
    expect(chamadas().filter((u) => u === "/auth/refresh")).toHaveLength(1)
  })

  it("não tenta refresh quando o próprio login falha", async () => {
    fetchMock.mockResolvedValueOnce(resposta(401, { detail: "E-mail ou senha incorretos" }))
    const erro = await apiFetch("/auth/login", { method: "POST", body: {} }).catch((e: unknown) => e)
    expect(erro).toBeInstanceOf(ApiError)
    expect((erro as ApiError).message).toBe("E-mail ou senha incorretos")
    expect(chamadas()).toEqual(["/auth/login"])
  })
})

describe("mensagens de erro", () => {
  it("usa o detail de texto do back-end", async () => {
    fetchMock.mockResolvedValueOnce(resposta(409, { detail: "A regra já foi executada para 12/11/2026" }))
    await expect(apiFetch("/x")).rejects.toMatchObject({ status: 409, message: "A regra já foi executada para 12/11/2026" })
  })

  it("aproveita as validações em português dos 422 (prefixo 'Value error, ')", async () => {
    fetchMock.mockResolvedValueOnce(
      resposta(422, { detail: [{ type: "value_error", msg: "Value error, O horário deve estar entre 08:00 e 20:00 (janela de disparo)" }] }),
    )
    await expect(apiFetch("/regras/")).rejects.toMatchObject({
      message: "O horário deve estar entre 08:00 e 20:00 (janela de disparo)",
    })
  })

  it("troca as mensagens genéricas do Pydantic (em inglês) pela mensagem padrão", async () => {
    fetchMock.mockResolvedValueOnce(resposta(422, { detail: [{ type: "string_too_short", msg: "String should have at least 2 characters" }] }))
    await expect(apiFetch("/x")).rejects.toMatchObject({ status: 422, message: expect.stringContaining("Dados inválidos") })
  })

  it("API fora do ar vira status 0 com aviso de conexão", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"))
    await expect(apiFetch("/x")).rejects.toMatchObject({ status: 0, message: expect.stringContaining("conectar ao servidor") })
  })

  it("corpo que não é JSON cai na mensagem padrão do status", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>erro</html>", { status: 500 }))
    await expect(apiFetch("/x")).rejects.toMatchObject({ status: 500, message: expect.stringContaining("Erro inesperado") })
  })
})

describe("consultarSaude", () => {
  it("lê o corpo mesmo com 503 (dependência fora do ar)", async () => {
    const corpo = { status: "degradado", dependencias: { postgres: true, redis: false, rabbitmq: true } }
    fetchMock.mockResolvedValueOnce(resposta(503, corpo))
    await expect(consultarSaude()).resolves.toEqual(corpo)
  })

  it("devolve null quando a API não responde", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"))
    await expect(consultarSaude()).resolves.toBeNull()
  })
})
