import { afterEach, describe, expect, it, vi } from "vitest"
import * as fmt from "./formatos"

describe("números e moeda", () => {
  it("formata números e percentuais em pt-BR", () => {
    expect(fmt.numero(2847)).toBe("2.847")
    expect(fmt.percentual(94.75)).toBe("94,8%")
    expect(fmt.percentual(0)).toBe("0,0%")
  })

  it("mostra — quando a taxa não tem base (null)", () => {
    expect(fmt.percentual(null)).toBe("—")
    expect(fmt.percentual(undefined)).toBe("—")
  })

  it("formata o valor da dívida, que vem como texto", () => {
    // Intl usa espaço não separável entre "R$" e o número
    expect(fmt.moeda("1500.00").replace(/\s/g, " ")).toBe("R$ 1.500,00")
    expect(fmt.moeda(8320.5).replace(/\s/g, " ")).toBe("R$ 8.320,50")
    expect(fmt.moeda("abc")).toBe("—")
  })
})

describe("documentos e telefones (LGPD)", () => {
  it("formata CPF e CNPJ completos", () => {
    expect(fmt.documento("10433218100")).toBe("104.332.181-00")
    expect(fmt.documento("11222333000181")).toBe("11.222.333/0001-81")
    expect(fmt.documento("123")).toBe("123")
  })

  it("mascara CPF e CNPJ para listas", () => {
    expect(fmt.documentoMascarado("10433218100")).toBe("104.***.***-00")
    expect(fmt.documentoMascarado("11222333000181")).toBe("11.222.***/0001-81")
    expect(fmt.documentoMascarado("123")).toBe("***")
  })

  it("formata celular e fixo", () => {
    expect(fmt.telefone("47999990001")).toBe("(47) 99999-0001")
    expect(fmt.telefone("4733334444")).toBe("(47) 3333-4444")
    expect(fmt.telefone(null)).toBe("—")
  })
})

describe("datas", () => {
  afterEach(() => vi.useRealTimers())

  it("mostra data e hora no horário de Brasília", () => {
    expect(fmt.dataHora("2026-11-12T11:45:00Z")).toBe("12/11 08:45")
    expect(fmt.dataHora(null)).toBe("—")
  })

  it("não muda o dia de datas sem hora por causa do fuso", () => {
    expect(fmt.data("2026-11-01")).toBe("01/11/2026")
    expect(fmt.diaCurto("2026-11-01")).toBe("01/nov")
  })

  it("calcula hoje em Brasília, não em UTC", () => {
    vi.useFakeTimers()
    // 01:30 UTC do dia 13 ainda é 22:30 do dia 12 em Brasília
    vi.setSystemTime(new Date("2026-11-13T01:30:00Z"))
    expect(fmt.hojeISO()).toBe("2026-11-12")
  })

  it("soma dias atravessando mês e ano", () => {
    expect(fmt.somarDias("2026-11-12", -7)).toBe("2026-11-05")
    expect(fmt.somarDias("2026-03-01", -1)).toBe("2026-02-28")
    expect(fmt.somarDias("2026-12-31", 1)).toBe("2027-01-01")
  })

  it("corta os segundos do horário da regra", () => {
    expect(fmt.horario("09:30:00")).toBe("09:30")
  })
})

describe("cores", () => {
  it("destaca atrasos de 30 e 60 dias", () => {
    expect(fmt.corAtraso(10)).toBe("text-slate-700")
    expect(fmt.corAtraso(30)).toBe("text-amber-600")
    expect(fmt.corAtraso(60)).toBe("text-rose-600")
  })
})
