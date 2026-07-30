import { useState } from "react"

interface Devedor {
  id: string
  nome: string
  cpf: string
  email: string
  valor: number
  dias: number
  status: "em_cobranca" | "quitado" | "negociando" | "sem_contato"
  ultimo_contato: string
  canal: string
}

const devedores: Devedor[] = [
  { id: "D-3847", nome: "Fernanda Assunção", cpf: "823.***.***.12", email: "f.assuncao@email.com", valor: 3420, dias: 5, status: "em_cobranca", ultimo_contato: "—", canal: "E-mail" },
  { id: "D-3846", nome: "Marcos Tinoco ME", cpf: "22.487.***/0001-44", email: "financeiro@tinoco.com.br", valor: 18750, dias: 5, status: "em_cobranca", ultimo_contato: "—", canal: "E-mail" },
  { id: "D-3845", nome: "Rita Schommer", cpf: "512.***.***.88", email: "rita.s@gmail.com", valor: 890, dias: 8, status: "em_cobranca", ultimo_contato: "29/07", canal: "E-mail" },
  { id: "D-3844", nome: "Cooperativa Alfa Ltda", cpf: "07.321.***/0001-19", email: "adm@coop-alfa.com.br", valor: 42100, dias: 15, status: "negociando", ultimo_contato: "28/07", canal: "SMS" },
  { id: "D-3843", nome: "Paulo Rizzatto", cpf: "941.***.***.03", email: "p.rizzatto@outlook.com", valor: 2150, dias: 15, status: "em_cobranca", ultimo_contato: "—", canal: "SMS" },
  { id: "D-3842", nome: "Clínica São Lucas S/S", cpf: "14.782.***/0001-88", email: "contato@sao-lucas.med.br", valor: 9800, dias: 22, status: "sem_contato", ultimo_contato: "15/07", canal: "WhatsApp" },
  { id: "D-3841", nome: "Heloizi Vargas", cpf: "334.***.***.71", email: "heloizi.v@email.com", valor: 650, dias: 30, status: "em_cobranca", ultimo_contato: "22/07", canal: "WhatsApp" },
  { id: "D-3840", nome: "Gustavo Lenz & Cia", cpf: "98.112.***/0001-55", email: "gustavo@lenz.com.br", valor: 5600, dias: 31, status: "em_cobranca", ultimo_contato: "21/07", canal: "WhatsApp" },
  { id: "D-3839", nome: "Ana Paula Kretzer", cpf: "102.***.***.44", email: "ana.kretzer@gmail.com", valor: 1280, dias: 45, status: "negociando", ultimo_contato: "18/07", canal: "E-mail" },
  { id: "D-3838", nome: "Supermercados Bom Preço", cpf: "33.991.***/0001-02", email: "financeiro@bompreco.com.br", valor: 87400, dias: 60, status: "em_cobranca", ultimo_contato: "10/07", canal: "E-mail" },
  { id: "D-3837", nome: "Luciana Fraga", cpf: "671.***.***.09", email: "lu.fraga@yahoo.com.br", valor: 340, dias: 62, status: "quitado", ultimo_contato: "28/07", canal: "SMS" },
  { id: "D-3836", nome: "Construtora Meridional", cpf: "55.210.***/0001-77", email: "obras@meridional.eng.br", valor: 124000, dias: 75, status: "sem_contato", ultimo_contato: "01/07", canal: "WhatsApp" },
]

const statusLabel: Record<string, string> = {
  em_cobranca: "Em cobrança",
  quitado: "Quitado",
  negociando: "Negociando",
  sem_contato: "Sem contato",
}

const statusColor: Record<string, string> = {
  em_cobranca: "#3B82F6",
  quitado: "#10B981",
  negociando: "#F59E0B",
  sem_contato: "#EF4444",
}

export default function Devedores() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("todos")
  const [canalFilter, setCanalFilter] = useState("todos")

  const filtered = devedores.filter((d) => {
    const matchSearch =
      !search ||
      d.nome.toLowerCase().includes(search.toLowerCase()) ||
      d.cpf.includes(search)
    const matchStatus = statusFilter === "todos" || d.status === statusFilter
    const matchCanal = canalFilter === "todos" || d.canal.toLowerCase() === canalFilter
    return matchSearch && matchStatus && matchCanal
  })

  return (
    <div className="p-7 overflow-y-auto h-full">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, color: "var(--foreground)" }}>
            Devedores
          </h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>
            {devedores.length} devedores na carteira ativa · filtro aplicado: {filtered.length}
          </p>
        </div>
        <button
          className="px-4 py-2.5 rounded"
          style={{ background: "var(--card)", border: "1px solid var(--border-strong)", fontSize: 13, color: "var(--foreground)" }}
        >
          ↓ Exportar CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou CPF/CNPJ…"
          className="px-3 py-2 rounded outline-none transition-all"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border-strong)",
            color: "var(--foreground)",
            fontSize: 13,
            width: 280,
            fontFamily: "var(--font-sans)",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--primary)" }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-strong)" }}
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded outline-none"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border-strong)",
            color: "var(--foreground)",
            fontSize: 13,
            fontFamily: "var(--font-sans)",
          }}
        >
          <option value="todos">Todos os status</option>
          <option value="em_cobranca">Em cobrança</option>
          <option value="negociando">Negociando</option>
          <option value="quitado">Quitado</option>
          <option value="sem_contato">Sem contato</option>
        </select>

        <select
          value={canalFilter}
          onChange={(e) => setCanalFilter(e.target.value)}
          className="px-3 py-2 rounded outline-none"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border-strong)",
            color: "var(--foreground)",
            fontSize: 13,
            fontFamily: "var(--font-sans)",
          }}
        >
          <option value="todos">Todos os canais</option>
          <option value="e-mail">E-mail</option>
          <option value="sms">SMS</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["ID", "Devedor", "Valor", "Dias em atraso", "Canal", "Status", "Último contato"].map((h) => (
                <th
                  key={h}
                  className="px-5 py-3 text-left"
                  style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((d, i) => (
              <tr
                key={d.id}
                style={{
                  borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)" }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent" }}
              >
                <td className="px-5 py-3.5">
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted-foreground)" }}>{d.id}</span>
                </td>
                <td className="px-5 py-3.5">
                  <p style={{ fontSize: 13, color: "var(--foreground)", fontWeight: 500 }}>{d.nome}</p>
                  <p style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}>{d.cpf}</p>
                </td>
                <td className="px-5 py-3.5">
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 13,
                      fontWeight: 600,
                      color: d.valor > 10000 ? "#F59E0B" : "var(--foreground)",
                    }}
                  >
                    {d.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 13,
                      color: d.dias >= 60 ? "var(--danger)" : d.dias >= 30 ? "var(--warning)" : "var(--foreground)",
                    }}
                  >
                    D+{d.dias}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{d.canal}</span>
                </td>
                <td className="px-5 py-3.5">
                  <span
                    className="px-2 py-1 rounded-sm"
                    style={{
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                      color: statusColor[d.status],
                      background: `${statusColor[d.status]}15`,
                      border: `1px solid ${statusColor[d.status]}30`,
                    }}
                  >
                    {statusLabel[d.status]}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted-foreground)" }}>
                    {d.ultimo_contato}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="py-16 text-center">
            <p style={{ fontSize: 14, color: "var(--muted-foreground)" }}>Nenhum devedor encontrado com os filtros aplicados.</p>
          </div>
        )}
      </div>
    </div>
  )
}
