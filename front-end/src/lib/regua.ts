// Regras da régua do lado do front. Espelham o back-end:
// - limites de caracteres: back-end/app/core/templates.py (LIMITE_POR_CANAL)
// - janela de horário: back-end/app/core/config.py (JANELA_INICIO_HORA / JANELA_FIM_HORA)
// - nome 2–150 caracteres, dias de atraso 1–365: back-end/app/schemas/regra.py
// A validação que vale é a do servidor (inclusive o preview); aqui é só para
// avisar antes de enviar.

import type { Canal, RegraEntrada } from "./tipos"

export const LIMITE_POR_CANAL: Record<Canal, number> = {
  email: 5000,
  sms: 480,
  whatsapp: 1024,
}

export const JANELA = { inicio: "08:00", fim: "20:00" } // [início, fim)
export const DIAS_PARA_TRAS = 7 // POST /regras/{id}/executar aceita até 7 dias atrás

const PADRAO_VARIAVEL = /\{([^{}]*)\}/g

/** Variáveis usadas no template, na ordem, sem repetição. */
export function variaveisUsadas(template: string): string[] {
  return [...new Set(Array.from(template.matchAll(PADRAO_VARIAVEL), (m) => m[1]))]
}

/** Divide o template em trechos de texto e variáveis, para destacar no editor/visualização. */
export function trechosDoTemplate(template: string): { texto: string; variavel: boolean }[] {
  return template
    .split(/(\{[^{}]*\})/g)
    .filter(Boolean)
    .map((texto) => ({ texto, variavel: /^\{[^{}]*\}$/.test(texto) }))
}

export type ErrosRegra = Partial<Record<keyof RegraEntrada, string>>

/** Erros por campo; objeto vazio = pode enviar. `conhecidas` = variáveis da API. */
export function validarRegra(r: RegraEntrada, conhecidas: string[] | null): ErrosRegra {
  const erros: ErrosRegra = {}
  const nome = r.nome.trim()
  if (nome.length < 2 || nome.length > 150) erros.nome = "Use de 2 a 150 caracteres."

  if (!Number.isInteger(r.dias_atraso) || r.dias_atraso < 1 || r.dias_atraso > 365) {
    erros.dias_atraso = "Informe um número inteiro de 1 a 365."
  }

  if (!/^\d{2}:\d{2}$/.test(r.horario_disparo)) {
    erros.horario_disparo = "Informe o horário (HH:MM)."
  } else if (r.horario_disparo < JANELA.inicio || r.horario_disparo >= JANELA.fim) {
    erros.horario_disparo = `O horário deve estar entre ${JANELA.inicio} e ${JANELA.fim} (janela de disparo).`
  }

  const limite = LIMITE_POR_CANAL[r.canal]
  if (!r.template_mensagem.trim()) {
    erros.template_mensagem = "O template não pode ficar vazio."
  } else if (r.template_mensagem.length > limite) {
    erros.template_mensagem = `O template excede o limite de ${limite} caracteres do canal.`
  } else if (conhecidas) {
    const desconhecidas = variaveisUsadas(r.template_mensagem).filter((v) => !conhecidas.includes(v))
    if (desconhecidas.length > 0) {
      erros.template_mensagem = `Variável desconhecida: ${desconhecidas.map((v) => `{${v}}`).join(", ")}.`
    }
  }
  return erros
}
