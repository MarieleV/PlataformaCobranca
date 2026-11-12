import type { Perfil } from "../lib/tipos"

export type Page =
  | "dashboard"
  | "importar"
  | "validacao"
  | "regua"
  | "devedores"
  | "monitoramento"
  | "usuarios"

const TODOS: readonly Perfil[] = ["administrador", "gestor", "operador"]

// Quem pode ABRIR cada tela (espelha o role_required do back-end).
// Ações dentro da tela (ex.: excluir devedor, editar regra) são checadas na própria tela.
export const PERFIS_POR_PAGINA: Record<Page, readonly Perfil[]> = {
  dashboard: TODOS,
  importar: TODOS,
  validacao: TODOS,
  regua: TODOS, // listar/consultar: todos; criar/editar: gestor e administrador
  devedores: TODOS,
  monitoramento: TODOS,
  usuarios: ["administrador", "gestor"],
}

export const NOME_PERFIL: Record<Perfil, string> = {
  administrador: "Administrador",
  gestor: "Gestor",
  operador: "Operador",
}
