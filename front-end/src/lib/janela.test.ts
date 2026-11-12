import { describe, expect, it } from "vitest"
import { estadoJanela } from "./janela"

// Datas em UTC; Brasília = UTC−3. 12/11/2026 é quinta; 13 sexta; 14 sábado; 16 segunda.
const em = (iso: string) => estadoJanela(new Date(iso))

describe("janela de disparo (RN05)", () => {
  it("aberta em dia útil, com o próximo ciclo múltiplo de 5 minutos", () => {
    expect(em("2026-11-12T12:35:00Z")).toEqual({ aberta: true, detalhe: "Próximo ciclo às 09:40" })
    expect(em("2026-11-16T11:00:00Z")).toEqual({ aberta: true, detalhe: "Próximo ciclo às 08:05" })
    expect(em("2026-11-12T22:54:00Z")).toEqual({ aberta: true, detalhe: "Próximo ciclo às 19:55" })
  })

  it("antes das 8h abre no mesmo dia", () => {
    expect(em("2026-11-12T10:10:00Z")).toEqual({ aberta: false, detalhe: "Abre hoje às 08:00" })
  })

  it("depois do último ciclo (19:55) abre no próximo dia útil", () => {
    expect(em("2026-11-12T22:55:00Z")).toEqual({ aberta: false, detalhe: "Abre amanhã às 08:00" })
    expect(em("2026-11-12T22:59:00Z")).toEqual({ aberta: false, detalhe: "Abre amanhã às 08:00" })
  })

  it("sexta à noite e fim de semana abrem na segunda", () => {
    expect(em("2026-11-13T23:30:00Z").detalhe).toBe("Abre seg. às 08:00")
    expect(em("2026-11-14T13:00:00Z").detalhe).toBe("Abre seg. às 08:00")
    // domingo 23h: a segunda é amanhã
    expect(em("2026-11-16T02:00:00Z").detalhe).toBe("Abre amanhã às 08:00")
  })
})
