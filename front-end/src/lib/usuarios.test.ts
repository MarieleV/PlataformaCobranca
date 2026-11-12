import { describe, expect, it } from "vitest"
import { gerarSenha, validarEmail, validarNome, validarSenha } from "./usuarios"

describe("validarSenha (política do back-end)", () => {
  it.each([
    ["abc1", "pelo menos 8"],
    ["abcdefgh", "letra e um número"],
    ["12345678", "letra e um número"],
    ["x".repeat(128) + "1", "no máximo 128"],
  ])("recusa %j", (senha, trecho) => {
    expect(validarSenha(senha)).toContain(trecho)
  })

  it("aceita senha com letra e número entre 8 e 128", () => {
    expect(validarSenha("abcd1234")).toBeNull()
  })
})

describe("gerarSenha", () => {
  it("sempre gera senhas que passam na política", () => {
    for (let i = 0; i < 300; i++) expect(validarSenha(gerarSenha())).toBeNull()
  })

  it("gera senhas diferentes", () => {
    expect(new Set(Array.from({ length: 50 }, () => gerarSenha())).size).toBe(50)
  })
})

describe("nome e e-mail", () => {
  it("valida o tamanho do nome ignorando espaços nas pontas", () => {
    expect(validarNome(" X ")).not.toBeNull()
    expect(validarNome("Ana")).toBeNull()
  })

  it("valida o formato básico do e-mail", () => {
    expect(validarEmail("ana@empresa.com.br")).toBeNull()
    expect(validarEmail("ana@empresa")).not.toBeNull()
  })
})
