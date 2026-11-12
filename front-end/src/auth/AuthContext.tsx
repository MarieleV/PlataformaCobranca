import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { apiFetch, definirAoExpirarSessao } from "../lib/api"
import type { LoginResponse, Perfil, Usuario } from "../lib/tipos"

interface AuthContextValue {
  /** Usuário logado, ou null se não houver sessão. */
  usuario: Usuario | null
  /** true enquanto verifica, ao abrir o app, se já existe uma sessão (GET /auth/me). */
  carregando: boolean
  /** true quando o usuário foi deslogado porque a sessão não pôde ser renovada. */
  sessaoExpirada: boolean
  login: (email: string, senha: string) => Promise<void>
  logout: () => Promise<void>
  /** Relê GET /auth/me (ex.: depois de o usuário editar o próprio nome ou e-mail). */
  recarregarUsuario: () => Promise<void>
  /** RBAC na interface. A regra que vale é a do back-end; isto só esconde o que não se pode usar. */
  pode: (perfis: readonly Perfil[]) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [sessaoExpirada, setSessaoExpirada] = useState(false)
  const usuarioRef = useRef<Usuario | null>(null)

  useEffect(() => {
    usuarioRef.current = usuario
  }, [usuario])

  useEffect(() => {
    let cancelado = false

    definirAoExpirarSessao(() => {
      // Só avisa "sessão expirada" se havia alguém logado (não na primeira visita).
      if (usuarioRef.current) setSessaoExpirada(true)
      setUsuario(null)
    })

    // Os cookies sobrevivem ao F5: pergunta ao back-end quem está logado.
    apiFetch<Usuario>("/auth/me")
      .then((u) => {
        if (!cancelado) setUsuario(u)
      })
      .catch(() => {
        if (!cancelado) setUsuario(null)
      })
      .finally(() => {
        if (!cancelado) setCarregando(false)
      })

    return () => {
      cancelado = true
      definirAoExpirarSessao(null)
    }
  }, [])

  const login = useCallback(async (email: string, senha: string) => {
    const resposta = await apiFetch<LoginResponse>("/auth/login", {
      method: "POST",
      body: { email, password: senha },
    })
    setSessaoExpirada(false)
    setUsuario(resposta.user)
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiFetch("/auth/logout", { method: "DELETE" })
    } catch {
      // Mesmo que a API falhe, a tela volta para o login.
    } finally {
      setSessaoExpirada(false)
      setUsuario(null)
    }
  }, [])

  const recarregarUsuario = useCallback(async () => {
    try {
      setUsuario(await apiFetch<Usuario>("/auth/me"))
    } catch {
      // Sem sessão: o apiFetch já avisou o contexto (aoExpirarSessao)
    }
  }, [])

  const pode = useCallback(
    (perfis: readonly Perfil[]) => usuario !== null && perfis.includes(usuario.perfil),
    [usuario],
  )

  const valor = useMemo(
    () => ({ usuario, carregando, sessaoExpirada, login, logout, recarregarUsuario, pode }),
    [usuario, carregando, sessaoExpirada, login, logout, recarregarUsuario, pode],
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>")
  return ctx
}
