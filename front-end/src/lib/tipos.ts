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
export type StatusComunicacao = "pendente" | "enviado" | "entregue" | "falha" | "bounce"

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

/** Uma linha com erro no relatório de validação (ErroLoteResponse). Todo erro rejeita a linha. */
export interface ErroLote {
  id: string
  /** Linha na planilha (1 = cabeçalho; erros estruturais do arquivo também usam 1). */
  numero_linha: number
  campo: string
  regra_violada: string
  valor_informado: string | null
}

export interface UploadLoteResponse {
  message: string
  lote_id: string
}

// --- Devedores (back-end/app/schemas/devedor.py) ---------------------------
// LGPD: cpf_cnpj, e-mail e telefones são dados pessoais. Não registre em console.

export interface Devedor {
  id: string
  lote_id: string
  /** Só dígitos (11 = CPF, 14 = CNPJ). */
  cpf_cnpj: string
  nome: string
  email: string | null
  telefone: string | null
  whatsapp: string | null
  /** Decimal serializado como texto, ex.: "1500.00". */
  valor_divida: string
  data_vencimento: DataISO
  dias_atraso: number
  status: StatusDevedor
  criado_em: DataHoraISO
}

export interface Pagina<T> {
  total: number
  skip: number
  limit: number
  itens: T[]
}

/** Histórico de comunicações do devedor (ComunicacaoResponse). */
export interface Comunicacao {
  id: string
  job_id: string
  canal: Canal
  status: StatusComunicacao
  tentativas: number
  enviado_em: DataHoraISO | null
  codigo_erro: string | null
  mensagem_erro: string | null
  criado_em: DataHoraISO
}

// --- Régua (back-end/app/schemas/regra.py) ---------------------------------

export interface Regra {
  id: string
  usuario_id: string
  nome: string
  dias_atraso: number
  canal: Canal
  template_mensagem: string
  /** "HH:MM:SS" (horário de Brasília) */
  horario_disparo: string
  ativa: boolean
  criado_em: DataHoraISO
}

/** Corpo do POST /regras/ (nasce inativa) e, parcial, do PATCH /regras/{id}. */
export interface RegraEntrada {
  nome: string
  dias_atraso: number
  canal: Canal
  template_mensagem: string
  /** "HH:MM" */
  horario_disparo: string
}

export interface StatusRegua {
  regua_ativa: boolean
  regras_ativas: number
  total_regras: number
  mensagem: string
}

export interface VariavelTemplate {
  nome: string
  placeholder: string
  descricao: string
  exemplo: string
}

export interface PreviewTemplate {
  mensagem: string
  tamanho: number
  limite: number
  variaveis_usadas: string[]
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

/** Comunicação de um job (ComunicacaoDoJobResponse), já com o nome do devedor. */
export interface ComunicacaoDoJob {
  id: string
  devedor_id: string
  devedor_nome: string
  canal: Canal
  status: StatusComunicacao
  tentativas: number
  /** Preenchido quando há reenvio agendado (falha temporária, RN07). */
  proxima_tentativa_em: DataHoraISO | null
  codigo_erro: string | null
  mensagem_erro: string | null
  enviado_em: DataHoraISO | null
  criado_em: DataHoraISO
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
