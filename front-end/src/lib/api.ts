// Cliente HTTP da API.
//
// A autenticação é feita por cookies httpOnly gravados pelo back-end: o
// JavaScript nunca vê o token. Por isso toda requisição vai com
// credentials: "include". Em 401, tenta renovar a sessão (POST /auth/refresh)
// uma única vez e repete a requisição; se não der, avisa o AuthContext.
//
// LGPD: não registre corpos de requisição/resposta em console ou logs.

import type { Saude } from "./tipos"

const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8000").replace(/\/+$/, "")

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

// Status 0 = a requisição nem chegou ao servidor (API fora do ar, CORS, rede).
const MENSAGENS_PADRAO: Record<number, string> = {
  0: "Não foi possível conectar ao servidor. Verifique se a API está no ar.",
  401: "Sua sessão expirou. Entre novamente.",
  403: "Você não tem permissão para esta ação.",
  404: "Registro não encontrado.",
  409: "A operação conflita com o estado atual do registro.",
  413: "Arquivo grande demais.",
  422: "Dados inválidos. Revise os campos e tente novamente.",
  429: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  503: "Serviço temporariamente indisponível. Tente novamente em instantes.",
}

function mensagemPadrao(status: number): string {
  return MENSAGENS_PADRAO[status] ?? "Erro inesperado no servidor. Tente novamente."
}

// O FastAPI devolve { detail: string } nos erros de negócio e
// { detail: [{ msg, loc, ... }] } nos erros de validação (422).
async function extrairMensagem(resposta: Response): Promise<string> {
  try {
    const corpo: unknown = await resposta.json()
    if (corpo && typeof corpo === "object" && "detail" in corpo) {
      const { detail } = corpo as { detail: unknown }
      if (typeof detail === "string" && detail) return detail
    }
  } catch {
    // corpo vazio ou não-JSON: usa a mensagem padrão
  }
  return mensagemPadrao(resposta.status)
}

// --- Sessão expirada -------------------------------------------------------

let aoExpirarSessao: (() => void) | null = null

/** O AuthContext registra aqui o que fazer quando a sessão não puder ser renovada. */
export function definirAoExpirarSessao(callback: (() => void) | null): void {
  aoExpirarSessao = callback
}

// Várias requisições podem tomar 401 ao mesmo tempo. Todas aguardam o MESMO
// refresh: como o back-end faz rotação do refresh token, um segundo refresh
// com o token antigo seria recusado e derrubaria a sessão.
let refreshEmAndamento: Promise<boolean> | null = null

function renovarSessao(): Promise<boolean> {
  refreshEmAndamento ??= fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshEmAndamento = null
    })
  return refreshEmAndamento
}

// Rotas em que um 401 NÃO deve disparar refresh (credencial errada no login,
// o próprio refresh e o logout).
const ROTAS_SEM_RENOVACAO = ["/auth/login", "/auth/refresh", "/auth/logout"]

// --- Requisição -------------------------------------------------------------

type Metodo = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

export interface OpcoesRequisicao {
  method?: Metodo
  /** Objeto (vai como JSON) ou FormData (upload multipart). */
  body?: unknown
  signal?: AbortSignal
}

async function enviar(path: string, opcoes: OpcoesRequisicao): Promise<Response> {
  const { method = "GET", body, signal } = opcoes
  const headers: Record<string, string> = { Accept: "application/json" }
  let corpo: BodyInit | undefined

  if (body instanceof FormData) {
    corpo = body // o navegador define o Content-Type com o boundary
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json"
    corpo = JSON.stringify(body)
  }

  try {
    return await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: corpo,
      credentials: "include",
      signal,
    })
  } catch (erro) {
    if (erro instanceof DOMException && erro.name === "AbortError") throw erro
    throw new ApiError(0, mensagemPadrao(0))
  }
}

/**
 * Faz uma chamada à API e devolve o JSON da resposta já tipado.
 * Lança ApiError (com status e mensagem pronta para a tela) em caso de erro.
 */
export async function apiFetch<T>(path: string, opcoes: OpcoesRequisicao = {}): Promise<T> {
  let resposta = await enviar(path, opcoes)

  if (resposta.status === 401 && !ROTAS_SEM_RENOVACAO.includes(path)) {
    if (await renovarSessao()) {
      resposta = await enviar(path, opcoes)
    }
    if (resposta.status === 401) {
      aoExpirarSessao?.()
    }
  }

  if (!resposta.ok) {
    throw new ApiError(resposta.status, await extrairMensagem(resposta))
  }

  if (resposta.status === 204) return undefined as T
  return (await resposta.json()) as T
}

/**
 * GET /health (público). Responde 503 quando alguma dependência caiu, mas com o
 * detalhe no corpo — por isso não passa pelo apiFetch, que descartaria o corpo.
 * Devolve null se a API nem respondeu.
 */
export async function consultarSaude(signal?: AbortSignal): Promise<Saude | null> {
  try {
    const resposta = await fetch(`${API_URL}/health`, { signal })
    return (await resposta.json()) as Saude
  } catch (erro) {
    if (erro instanceof DOMException && erro.name === "AbortError") throw erro
    return null
  }
}

export { API_URL }
