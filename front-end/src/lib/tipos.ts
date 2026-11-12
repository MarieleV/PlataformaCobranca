// Tipos compartilhados com a API. Fonte da verdade: GET /openapi.json do back-end.

export type Perfil = "administrador" | "gestor" | "operador"

// UsuarioAutenticado (back-end/app/schemas/auth.py)
export interface Usuario {
  id: string
  nome: string
  email: string
  perfil: Perfil
}

// LoginResponse
export interface LoginResponse {
  message: string
  user: Usuario
}

// MensagemResponse
export interface MensagemResponse {
  message: string
}
