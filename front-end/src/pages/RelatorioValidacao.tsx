import { useState } from "react"

interface ErrorEntry {
  linha: number
  campo: string
  valor: string
  regra: string
  desc: string
}

const errors: ErrorEntry[] = [
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

  // Cálculo das porcentagens para a barra de progresso
  const sucessoPct = (sucesso / total) * 100
  const rejeicaoPct = (rejeicoes / total) * 100
  const avisoPct = (avisos / total) * 100

  return (
    <div className="p-6 sm:p-8 overflow-y-auto h-full bg-slate-50 font-sans">
      
      {/* --- HEADER --- */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Relatório de Validação
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Lote: <span className="font-mono font-medium text-slate-700 bg-slate-200/60 px-1.5 py-0.5 rounded">lote_julho_cooperativa_sc.xlsx</span> · Processado em 29/07 08:12
          </p>
        </div>
        
        <button className="self-start sm:self-auto flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-xs font-semibold font-mono transition-all shadow-sm">
          <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Exportar CSV de erros
        </button>
      </div>

      {/* --- STATS GRID --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Registros", value: total.toLocaleString("pt-BR"), color: "text-slate-900", pct: null },
          {
            label: "Importados com sucesso",
            value: sucesso.toLocaleString("pt-BR"),
            color: "text-emerald-600",
            pct: ((sucesso / total) * 100).toFixed(1) + "%",
          },
          {
            label: "Rejeitados",
            value: rejeicoes,
            color: "text-rose-600",
            pct: ((rejeicoes / total) * 100).toFixed(2) + "%",
          },
          {
            label: "Avisos",
            value: avisos,
            color: "text-amber-600",
            pct: ((avisos / total) * 100).toFixed(2) + "%",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="p-5 rounded-2xl bg-white border border-slate-200/60 shadow-sm"
          >
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              {s.label}
            </p>
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-3xl font-sans tracking-tight text-slate-900">
                {s.value}
              </span>
              {s.pct && (
                <span className={`font-mono text-xs font-semibold ${s.color}`}>
                  {s.pct}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* --- PROGRESS BAR VISUAL --- */}
      <div className="mb-6 rounded-2xl bg-white p-5 border border-slate-200/60 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Distribuição do lote</p>
          <span className="text-xs font-mono text-slate-400">100% processado</span>
        </div>
        
        {/* Barra segmentada */}
        <div className="h-3 w-full flex rounded-full overflow-hidden bg-slate-100 gap-0.5">
          <div style={{ width: `${sucessoPct}%` }} className="bg-emerald-500 transition-all duration-500" title="Sucesso" />
          <div style={{ width: `${rejeicaoPct}%` }} className="bg-rose-500 transition-all duration-500" title="Rejeitados" />
          <div style={{ width: `${avisoPct}%` }} className="bg-amber-500 transition-all duration-500" title="Avisos" />
        </div>

        <div className="flex flex-wrap gap-6 mt-4">
          {[
            { color: "bg-emerald-500", label: "Sucesso" },
            { color: "bg-rose-500", label: "Rejeitados" },
            { color: "bg-amber-500", label: "Avisos" },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${l.color}`} />
              <span className="text-xs font-medium text-slate-600 font-mono">{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* --- ERROR TABLE CONTAINER --- */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        
        {/* Table Header com Filtros */}
        <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Linhas com problema ({errors.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Inconsistências encontradas nas regras de validação do arquivo</p>
          </div>
          
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-lg border border-slate-200">
            {(["todos", "erro", "aviso"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${
                  filter === f
                    ? "bg-white text-slate-900 shadow-sm border border-slate-200/60"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50/50">
              <tr>
                {["Linha", "Campo", "Valor encontrado", "Regra", "Descrição"].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((e, i) => {
                const isWarn = warnRules.has(e.regra)
                return (
                  <tr
                    key={i}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="px-6 py-4 font-mono text-xs font-medium text-slate-500">
                      #{e.linha}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                        {e.campo}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-800">
                      {e.valor || <span className="text-slate-400 italic">(vazio)</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold font-mono border ${
                          isWarn
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}
                      >
                        {e.regra}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-600">
                      {e.desc}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}