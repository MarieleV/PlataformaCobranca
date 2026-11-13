import { describe, expect, it } from "vitest"
import { PERFIS_POR_ACAO, PERFIS_POR_PAGINA } from "../auth/permissoes"
import { jobEmAndamento } from "./jobs"
import type { Job } from "./tipos"

describe("jobEmAndamento", () => {
  it("agendado e executando ainda não terminaram", () => {
    const job = (status: Job["status"]) => ({ status }) as Job
    expect(jobEmAndamento(job("agendado"))).toBe(true)
    expect(jobEmAndamento(job("executando"))).toBe(true)
    expect(jobEmAndamento(job("concluido"))).toBe(false)
    expect(jobEmAndamento(job("falhou"))).toBe(false)
  })
})

// As permissões da interface espelham o role_required do back-end (RN06)
describe("permissões", () => {
  it("operador não acessa Usuários nem Auditoria; gestor não acessa Auditoria", () => {
    expect(PERFIS_POR_PAGINA.usuarios).not.toContain("operador")
    expect(PERFIS_POR_PAGINA.auditoria).toEqual(["administrador"])
    expect(PERFIS_POR_PAGINA.dashboard).toContain("operador")
  })

  it("ações restritas", () => {
    expect(PERFIS_POR_ACAO.excluirDevedor).toEqual(["administrador"])
    expect(PERFIS_POR_ACAO.quitarDevedor).not.toContain("operador")
    expect(PERFIS_POR_ACAO.gerenciarRegua).not.toContain("operador")
    expect(PERFIS_POR_ACAO.administrarUsuarios).toEqual(["administrador"])
  })
})
