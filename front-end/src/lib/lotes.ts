// Regras de importação de lotes do lado do front.
// Os limites espelham o padrão do back-end (MAX_UPLOAD_MB e MAX_REGISTROS_LOTE em
// back-end/app/core/config.py). A validação que vale é a do servidor: aqui só
// evitamos enviar um arquivo que com certeza seria recusado.

import type { Lote } from "./tipos"

export const EXTENSOES_ACEITAS = [".csv", ".xlsx", ".xls"] as const
export const TAMANHO_MAXIMO_MB = 20
export const MAXIMO_REGISTROS = 50_000

/** Intervalo do polling de GET /lotes/{id} enquanto o lote processa. */
export const INTERVALO_POLLING_MS = 1500

export const COLUNAS_OBRIGATORIAS = [
  { coluna: "cpf_cnpj", descricao: "CPF (11 dígitos) ou CNPJ (14), com ou sem pontuação" },
  { coluna: "nome", descricao: "Nome completo ou razão social (até 255 caracteres)" },
  { coluna: "email", descricao: "E-mail válido para o disparo" },
  { coluna: "valor_divida", descricao: "Valor positivo com ponto decimal (ex.: 1500.00)" },
  { coluna: "data_vencimento", descricao: "DD/MM/AAAA ou AAAA-MM-DD" },
] as const

export const COLUNAS_OPCIONAIS = [
  { coluna: "telefone", descricao: "DDD + número, para SMS (ex.: 47991234567)" },
  { coluna: "whatsapp", descricao: "DDD + número, para WhatsApp" },
] as const

/** Nome amigável do campo de um erro de validação. */
export const NOME_CAMPO: Record<string, string> = {
  cpf_cnpj: "CPF/CNPJ",
  nome: "Nome",
  email: "E-mail",
  valor_divida: "Valor",
  data_vencimento: "Vencimento",
  telefone: "Telefone",
  whatsapp: "WhatsApp",
  cabecalho: "Cabeçalho",
  arquivo: "Arquivo",
}

export function emAndamento(lote: Lote | null | undefined): boolean {
  return lote?.status === "pendente" || lote?.status === "processando"
}

/** Mensagem de erro se o arquivo com certeza seria recusado pela API; null se pode enviar. */
export function validarArquivo(arquivo: File): string | null {
  const nome = arquivo.name.toLowerCase()
  if (!EXTENSOES_ACEITAS.some((ext) => nome.endsWith(ext))) {
    return "Formato inválido. Envie arquivos .csv, .xlsx ou .xls."
  }
  if (arquivo.size === 0) {
    return "O arquivo está vazio."
  }
  if (arquivo.size > TAMANHO_MAXIMO_MB * 1024 * 1024) {
    return `Arquivo maior que o limite de ${TAMANHO_MAXIMO_MB} MB.`
  }
  return null
}

/** Baixa um CSV modelo com o cabeçalho certo e duas linhas fictícias de exemplo. */
export function baixarPlanilhaModelo(): void {
  const linhas = [
    "cpf_cnpj,nome,email,valor_divida,data_vencimento,telefone,whatsapp",
    "529.982.247-25,Maria Exemplo da Silva,maria.exemplo@email.com,1500.00,15/10/2026,47991234567,47991234567",
    "11.222.333/0001-81,Empresa Exemplo Ltda,financeiro@empresaexemplo.com,8320.50,2026-10-01,,",
  ]
  // BOM para o Excel abrir os acentos corretamente
  const blob = new Blob(["﻿" + linhas.join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = "modelo_lote_devedores.csv"
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** "lote_julho.xlsx" -> "erros_lote_julho.csv" */
export function nomeCsvDeErros(lote: Lote): string {
  const base = lote.nome_arquivo.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "_") || "lote"
  return `erros_${base}.csv`
}
