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

// --- Enums (back-end/app/models/domain.py) ---------------------------------

export type Canal = "email" | "sms" | "whatsapp"
export type StatusLote = "pendente" | "processando" | "concluido" | "erro"
export type StatusJob = "agendado" | "executando" | "concluido" | "falhou"
export type StatusDevedor = "ativo" | "comunicado" | "negociando" | "quitado" | "inativo"

// Datas: "YYYY-MM-DD" (date) e ISO 8601 com fuso (datetime).
type DataISO = string
type DataHoraISO = string

// --- Lotes (back-end/app/schemas/lote.py) ----------------------------------

export interface Lote {
  id: string
  nome_arquivo: string
  status: StatusLote
  usuario_id: string
  total_registros: number
  total_importados: number
  total_atualizados: number
  total_rejeitados: number
  iniciado_em: DataHoraISO | null
  finalizado_em: DataHoraISO | null
  criado_em: DataHoraISO
  progresso_percentual: number
}

// --- Jobs (back-end/app/schemas/job.py) ------------------------------------

export interface Job {
  id: string
  regra_id: string
  regra_nome: string
  canal: Canal
  dia_referencia: DataISO
  status: StatusJob
  total_alvos: number
  total_sucesso: number
  total_falhas: number
  inicio_em: DataHoraISO | null
  fim_em: DataHoraISO | null
  criado_em: DataHoraISO
  pendentes: number
  progresso_percentual: number
}

// --- Dashboard (back-end/app/schemas/dashboard.py) -------------------------

/** Contagem de comunicações. Taxas em % (1 casa) ou null quando não há base. */
export interface Contagem {
  disparos: number
  sucesso: number
  falhas: number
  aguardando: number
  taxa_entrega: number | null
}

export interface CanalKPI extends Contagem {
  canal: Canal
}

export interface PontoTimeline {
  dia: DataISO
  disparos: number
  sucesso: number
  falhas: number
}

export interface KPIsPeriodo extends Contagem {
  devedores_alcancados: number
  devedores_quitados: number
  taxa_conversao: number | null
  meta_taxa_entrega: number
}

export interface Dashboard {
  dias: number
  data_inicial: DataISO
  data_final: DataISO
  base: {
    total: number
    por_status: Record<StatusDevedor, number>
  }
  hoje: Contagem
  periodo: KPIsPeriodo
  por_canal: CanalKPI[]
  timeline: PontoTimeline[]
  ultimos_lotes: Lote[]
  ultimos_jobs: Job[]
}

// --- Health (GET /health, público) -----------------------------------------

export interface Saude {
  status: "ok" | "degradado"
  dependencias: Record<"postgres" | "redis" | "rabbitmq", boolean>
}
