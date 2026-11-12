// Formatação para a tela (pt-BR, horário de Brasília) e rótulos dos enums da API.

import type { Canal, StatusComunicacao, StatusDevedor, StatusJob, StatusLote } from "./tipos"

const FUSO = "America/Sao_Paulo"

const fmtNumero = new Intl.NumberFormat("pt-BR")
const fmtPercentual = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const fmtDataHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
})
const fmtHora = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" })
const fmtDataLonga = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO, weekday: "long", day: "numeric", month: "long", year: "numeric",
})

const fmtMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

/** "1500.00" ou 1500 -> "R$ 1.500,00" */
export function moeda(valor: string | number): string {
  const n = typeof valor === "number" ? valor : Number(valor)
  return Number.isFinite(n) ? fmtMoeda.format(n) : "—"
}

/** "10433218100" -> "104.332.181-00"; CNPJ -> "11.222.333/0001-81" */
export function documento(digitos: string): string {
  if (digitos.length === 11) return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
  if (digitos.length === 14) return digitos.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
  return digitos
}

// Versão mascarada para listas (LGPD): CPF "104.***.***-00"; CNPJ "11.222.***" + "/0001-81"
export function documentoMascarado(digitos: string): string {
  if (digitos.length === 11) return `${digitos.slice(0, 3)}.***.***-${digitos.slice(9)}`
  if (digitos.length === 14) return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.***/${digitos.slice(8, 12)}-${digitos.slice(12)}`
  return "***"
}

/** "47999990001" -> "(47) 99999-0001" */
export function telefone(digitos: string | null): string {
  if (!digitos) return "—"
  if (digitos.length === 11) return digitos.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")
  if (digitos.length === 10) return digitos.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3")
  return digitos
}

/** 2847 -> "2.847" */
export function numero(valor: number): string {
  return fmtNumero.format(valor)
}

/** 94.7 -> "94,7%"; null (sem base de cálculo) -> "—" */
export function percentual(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? "—" : `${fmtPercentual.format(valor)}%`
}

/** ISO com fuso -> "29/07 08:12" (Brasília) */
export function dataHora(iso: string | null | undefined): string {
  return iso ? fmtDataHora.format(new Date(iso)).replace(",", "") : "—"
}

/** Date -> "08:12" (Brasília) */
export function hora(data: Date): string {
  return fmtHora.format(data)
}

/** Date -> "quarta-feira, 30 de julho de 2026" */
export function dataLonga(data: Date): string {
  return fmtDataLonga.format(data)
}

const fmtISO = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" })

/** Data de hoje em Brasília, "YYYY-MM-DD" (a mesma referência do back-end). */
export function hojeISO(): string {
  return fmtISO.format(new Date())
}

/** "2026-11-12", -7 -> "2026-11-05" (aritmética em UTC, sem efeito de fuso). */
export function somarDias(isoData: string, dias: number): string {
  const [ano, mes, dia] = isoData.split("-").map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10)
}

/** "09:00:00" -> "09:00" */
export function horario(valor: string): string {
  return valor.slice(0, 5)
}

// "YYYY-MM-DD" é uma data sem hora: não passa por new Date() para não mudar de dia com o fuso.
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]

/** "2026-07-29" -> "29/jul" */
export function diaCurto(isoData: string): string {
  const [, mes, dia] = isoData.split("-")
  return `${dia}/${MESES[Number(mes) - 1]}`
}

/** "2026-07-29" -> "29/07/2026" */
export function data(isoData: string): string {
  const [ano, mes, dia] = isoData.split("-")
  return `${dia}/${mes}/${ano}`
}

// --- Rótulos e cores -------------------------------------------------------

export const NOME_CANAL: Record<Canal, string> = {
  email: "E-mail",
  sms: "SMS",
  whatsapp: "WhatsApp",
}

/** Cores fixas por canal (hex, para o Recharts) — as mesmas em todas as telas. */
export const COR_CANAL: Record<Canal, string> = {
  email: "#2563eb", // blue-600
  sms: "#8b5cf6", // violet-500
  whatsapp: "#10b981", // emerald-500
}

interface Rotulo {
  texto: string
  /** Classes Tailwind do badge */
  classe: string
}

const VERDE = "bg-emerald-50 text-emerald-700 border-emerald-200"
const AZUL = "bg-blue-50 text-blue-700 border-blue-200"
const CINZA = "bg-slate-50 text-slate-600 border-slate-200"
const VERMELHO = "bg-rose-50 text-rose-700 border-rose-200"
const AMARELO = "bg-amber-50 text-amber-700 border-amber-200"

export const STATUS_LOTE: Record<StatusLote, Rotulo> = {
  pendente: { texto: "Na fila", classe: CINZA },
  processando: { texto: "Processando", classe: AZUL },
  concluido: { texto: "Concluído", classe: VERDE },
  erro: { texto: "Erro", classe: VERMELHO },
}

export const STATUS_JOB: Record<StatusJob, Rotulo> = {
  agendado: { texto: "Agendado", classe: CINZA },
  executando: { texto: "Em execução", classe: AZUL },
  concluido: { texto: "Concluído", classe: VERDE },
  falhou: { texto: "Falhou", classe: VERMELHO },
}

export const STATUS_DEVEDOR: Record<StatusDevedor, Rotulo & { descricao: string }> = {
  ativo: { texto: "Ativo", classe: AZUL, descricao: "Em cobrança: a régua envia mensagens." },
  comunicado: { texto: "Comunicado", classe: "bg-violet-50 text-violet-700 border-violet-200", descricao: "Já recebeu comunicação; continua na régua." },
  negociando: { texto: "Negociando", classe: AMARELO, descricao: "Em negociação; a régua para de enviar mensagens." },
  quitado: { texto: "Quitado", classe: VERDE, descricao: "Dívida paga. Definitivo: não pode ser reaberto." },
  inativo: { texto: "Inativo", classe: CINZA, descricao: "Fora da cobrança; a régua não envia mensagens." },
}

export const STATUS_COMUNICACAO: Record<StatusComunicacao, Rotulo> = {
  pendente: { texto: "Pendente", classe: CINZA },
  enviado: { texto: "Enviado", classe: VERDE },
  entregue: { texto: "Entregue", classe: VERDE },
  falha: { texto: "Falha", classe: AMARELO },
  bounce: { texto: "Bounce", classe: VERMELHO },
}
