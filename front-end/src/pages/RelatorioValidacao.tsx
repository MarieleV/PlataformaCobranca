import { useState } from "react"

const errors = [
  { linha: 12, campo: "cpf_cnpj", valor: "123.456.789-00", regra: "RN04", desc: "CPF inválido (dígito verificador incorreto)" },
  { linha: 47, campo: "valor_divida", valor: "-350.00", regra: "RN-VAL", desc: "Valor da dívida não pode ser negativo" },
  { linha: 83, campo: "cpf_cnpj", valor: "00.000.000/0000-00", regra: "RN04", desc: "CNPJ inválido (zeros repetidos)" },
  { linha: 119, campo: "data_vencimento", valor: "31/13/2026", regra: "RN-VAL", desc: "Data inválida: mês 13 não existe" },
  { linha: 201, campo: "cpf_cnpj", valor: "111.111.111-11", regra: "RN04", desc: "CPF inválido (sequência repetida)" },
  { linha: 256, campo: "email", valor: "joao@", regra: "RN-WARN", desc: "E-mail malformado (aviso — não rejeitado)" },
  { linha: 344, campo: "cpf_cnpj", valor: "99.999.999/0001-99", regra: "RN04", desc: "CNPJ inválido (dígito verificador incorreto)" },
  { linha: 512, campo: "valor_divida", valor: "", regra: "RN-VAL", desc: "Campo obrigatório ausente" },
]

const warnRules = new Set(["RN-WARN"])

export default function RelatorioValidacao() {
  const [filter, setFilter] = useState<"todos" | "erro" | "aviso">("todos")

  const total = 3248
  const rejeicoes = errors.filter((e) => !warnRules.has(e.regra)).length
  const avisos = errors.filter((e) => warnRules.has(e.regra)).length
  const sucesso = total - rejeicoes

  const filtered = errors.filter((e) => {
    if (filter === "erro") return !warnRules.has(e.regra)
    if (filter === "aviso") return warnRules.has(e.regra)
    return true
  })

  return (
    <div className="p-7 overflow-y-auto h-full">
      <div className="mb-7 flex items-start justify-between">
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, color: "var(--foreground)" }}>
            Relatório de Validação
          </h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>
            Lote: <span style={{ fontFamily: "var(--font-mono)", color: "var(--foreground)" }}>lote_julho_cooperativa_sc.xlsx</span> · Processado em 29/07 08:12
          </p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2.5 rounded transition-all"
          style={{ background: "var(--card)", border: "1px solid var(--border-strong)", fontSize: 13, color: "var(--foreground)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)" }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--card)" }}
        >
          ↓ Exportar CSV de erros
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Registros", value: total.toLocaleString("pt-BR"), color: "var(--foreground)", pct: null },
          {
            label: "Importados com sucesso",
            value: sucesso.toLocaleString("pt-BR"),
            color: "var(--accent)",
            pct: ((sucesso / total) * 100).toFixed(1) + "%",
          },
          {
            label: "Rejeitados",
            value: rejeicoes,
            color: "var(--danger)",
            pct: ((rejeicoes / total) * 100).toFixed(2) + "%",
          },
          {
            label: "Avisos",
            value: avisos,
            color: "var(--warning)",
            pct: ((avisos / total) * 100).toFixed(2) + "%",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="p-5 rounded"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <p style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {s.label}
            </p>
            <div className="flex items-baseline gap-3">
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 28, color: s.color }}>
                {s.value}
              </span>
              {s.pct && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: s.color, opacity: 0.8 }}>
                  {s.pct}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Progress bar visual */}
      <div className="mb-6 rounded overflow-hidden p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 10 }}>Distribuição do lote</p>
        <div style={{ height: 10, display: "flex", borderRadius: 5, overflow: "hidden" }}>
          <div style={{ flex: sucesso, background: "var(--accent)" }} />
          <div style={{ flex: rejeicoes, background: "var(--danger)" }} />
          <div style={{ flex: avisos, background: "var(--warning)" }} />
        </div>
        <div className="flex gap-6 mt-3">
          {[
            { color: "var(--accent)", label: "Sucesso" },
            { color: "var(--danger)", label: "Rejeitados" },
            { color: "var(--warning)", label: "Avisos" },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-2">
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: l.color, display: "inline-block" }} />
              <span style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Error table */}
      <div className="rounded overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
          <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14, color: "var(--foreground)" }}>
            Linhas com problema ({errors.length})
          </p>
          <div className="flex gap-2">
            {(["todos", "erro", "aviso"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1 rounded text-xs transition-all"
                style={{
                  fontFamily: "var(--font-mono)",
                  background: filter === f ? "var(--primary)" : "var(--secondary)",
                  color: filter === f ? "#fff" : "var(--muted-foreground)",
                  border: filter === f ? "1px solid var(--primary)" : "1px solid var(--border-strong)",
                  textTransform: "capitalize",
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Linha", "Campo", "Valor encontrado", "Regra", "Descrição"].map((h) => (
                <th
                  key={h}
                  className="px-5 py-3 text-left"
                  style={{
                    fontSize: 11,
                    color: "var(--muted-foreground)",
                    fontFamily: "var(--font-mono)",
                    fontWeight: 500,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((e, i) => {
              const isWarn = warnRules.has(e.regra)
              return (
                <tr
                  key={i}
                  style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none" }}
                  onMouseEnter={(ev) => { (ev.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)" }}
                  onMouseLeave={(ev) => { (ev.currentTarget as HTMLElement).style.background = "transparent" }}
                >
                  <td className="px-5 py-3">
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted-foreground)" }}>
                      #{e.linha}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--primary)", background: "rgba(59,130,246,0.08)", padding: "2px 6px", borderRadius: 3 }}>
                      {e.campo}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--foreground)" }}>
                      {e.valor || <span style={{ color: "var(--muted-foreground)" }}>(vazio)</span>}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        color: isWarn ? "var(--warning)" : "var(--danger)",
                        background: isWarn ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)",
                        padding: "2px 6px",
                        borderRadius: 3,
                      }}
                    >
                      {e.regra}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span style={{ fontSize: 12, color: "var(--secondary-foreground)" }}>{e.desc}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
