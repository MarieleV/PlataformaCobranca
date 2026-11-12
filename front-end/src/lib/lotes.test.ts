import { describe, expect, it } from "vitest"
import { emAndamento, nomeCsvDeErros, validarArquivo } from "./lotes"
import type { Lote } from "./tipos"

const arquivo = (nome: string, bytes: number) => new File([new Uint8Array(bytes)], nome)

describe("validarArquivo", () => {
  it("aceita csv, xlsx e xls", () => {
    for (const nome of ["a.csv", "b.XLSX", "c.xls"]) expect(validarArquivo(arquivo(nome, 10))).toBeNull()
  })

  it("recusa outros formatos, arquivo vazio e acima de 20 MB", () => {
    expect(validarArquivo(arquivo("a.txt", 10))).toContain("Formato inválido")
    expect(validarArquivo(arquivo("a.csv", 0))).toContain("vazio")
    expect(validarArquivo(arquivo("a.csv", 20 * 1024 * 1024 + 1))).toContain("20 MB")
  })
})

describe("lotes", () => {
  const lote = (status: Lote["status"], nome = "lote julho.xlsx") => ({ status, nome_arquivo: nome }) as Lote

  it("sabe quando o lote ainda está processando", () => {
    expect(emAndamento(lote("pendente"))).toBe(true)
    expect(emAndamento(lote("processando"))).toBe(true)
    expect(emAndamento(lote("concluido"))).toBe(false)
    expect(emAndamento(null)).toBe(false)
  })

  it("monta um nome seguro para o CSV de erros", () => {
    expect(nomeCsvDeErros(lote("concluido", "lote julho.xlsx"))).toBe("erros_lote_julho.csv")
    expect(nomeCsvDeErros(lote("concluido", "../x/y.csv"))).toBe("erros_.._x_y.csv")
  })
})
