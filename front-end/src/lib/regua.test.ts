import { describe, expect, it } from "vitest"
import { LIMITE_POR_CANAL, trechosDoTemplate, validarRegra, variaveisUsadas } from "./regua"
import type { RegraEntrada } from "./tipos"

const VARIAVEIS = ["nome", "primeiro_nome", "valor", "data_vencimento", "dias_atraso"]
const valida: RegraEntrada = {
  nome: "Lembrete 5 dias",
  dias_atraso: 5,
  canal: "sms",
  horario_disparo: "09:00",
  template_mensagem: "Olá {primeiro_nome}, valor {valor}",
}

describe("validarRegra", () => {
  it("aceita uma regra válida", () => {
    expect(validarRegra(valida, VARIAVEIS)).toEqual({})
  })

  it("aponta erro em cada campo inválido", () => {
    const erros = validarRegra(
      { ...valida, nome: "x", dias_atraso: 0, horario_disparo: "20:00", template_mensagem: "Oi {link}" },
      VARIAVEIS,
    )
    expect(Object.keys(erros).sort()).toEqual(["dias_atraso", "horario_disparo", "nome", "template_mensagem"])
    expect(erros.template_mensagem).toContain("{link}")
  })

  it("respeita a janela 08:00–20:00 (fim exclusivo)", () => {
    expect(validarRegra({ ...valida, horario_disparo: "07:59" }, VARIAVEIS).horario_disparo).toBeDefined()
    expect(validarRegra({ ...valida, horario_disparo: "08:00" }, VARIAVEIS).horario_disparo).toBeUndefined()
    expect(validarRegra({ ...valida, horario_disparo: "19:59" }, VARIAVEIS).horario_disparo).toBeUndefined()
  })

  it("aplica o limite de caracteres do canal", () => {
    const longo = "x".repeat(LIMITE_POR_CANAL.sms + 1)
    expect(validarRegra({ ...valida, template_mensagem: longo }, VARIAVEIS).template_mensagem).toContain("480")
    expect(validarRegra({ ...valida, canal: "email", template_mensagem: longo }, VARIAVEIS)).toEqual({})
  })

  it("não acusa variável desconhecida enquanto a lista da API não chegou", () => {
    expect(validarRegra({ ...valida, template_mensagem: "Oi {link}" }, null)).toEqual({})
  })

  it("rejeita dias de atraso fracionados ou vazios", () => {
    expect(validarRegra({ ...valida, dias_atraso: 2.5 }, VARIAVEIS).dias_atraso).toBeDefined()
    expect(validarRegra({ ...valida, dias_atraso: Number.NaN }, VARIAVEIS).dias_atraso).toBeDefined()
  })
})

describe("templates", () => {
  it("lista as variáveis sem repetir, na ordem", () => {
    expect(variaveisUsadas("{nome} deve {valor}, {nome}")).toEqual(["nome", "valor"])
  })

  it("separa texto e variáveis para o destaque", () => {
    expect(trechosDoTemplate("Oi {nome}!")).toEqual([
      { texto: "Oi ", variavel: false },
      { texto: "{nome}", variavel: true },
      { texto: "!", variavel: false },
    ])
  })
})
