// Formatação para a tela (pt-BR, horário de Brasília) e rótulos dos enums da API.

import type { Canal, StatusDevedor, StatusJob, StatusLote } from "./tipos"

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

export const STATUS_DEVEDOR: Record<StatusDevedor, Rotulo> = {
  ativo: { texto: "Ativo", classe: AZUL },
  comunicado: { texto: "Comunicado", classe: CINZA },
  negociando: { texto: "Negociando", classe: AMARELO },
  quitado: { texto: "Quitado", classe: VERDE },
  inativo: { texto: "Inativo", classe: CINZA },
}
