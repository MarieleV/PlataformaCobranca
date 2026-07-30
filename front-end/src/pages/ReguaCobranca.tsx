import { useState } from "react"

interface Regra {
  id: string
  nome: string
  canal: "email" | "sms" | "whatsapp"
  prazo: number
  template: string
  ativa: boolean
  devedores: number
  taxaEntrega: string
}

const canalColor: Record<string, string> = {
  email: "#3B82F6",
  sms: "#A78BFA",
  whatsapp: "#10B981",
}

const canalLabel: Record<string, string> = {
  email: "E-mail",
  sms: "SMS",
  whatsapp: "WhatsApp",
}

const initialRegras: Regra[] = [
  {
    id: "R01",
    nome: "Lembrete Antecipado",
    canal: "email",
    prazo: 5,
    template: "Olá {nome}, seu vencimento de R$ {valor} está se aproximando em {dias} dias.",
    ativa: true,
    devedores: 842,
    taxaEntrega: "98.4%",
  },
  {
    id: "R02",
    nome: "Cobrança Pós-Vencimento",
    canal: "sms",
    prazo: 15,
    template: "{nome}, sua dívida de R$ {valor} está em aberto há {dias} dias. Regularize: {link}",
    ativa: true,
    devedores: 617,
    taxaEntrega: "91.7%",
  },
  {
    id: "R03",
    nome: "Escalada de Cobrança",
    canal: "whatsapp",
    prazo: 30,
    template: "Prezado(a) {nome}, informamos que o débito de R$ {valor} está com {dias} dias de atraso. Evite restrições no CPF/CNPJ.",
    ativa: true,
    devedores: 389,
    taxaEntrega: "87.2%",
  },
  {
    id: "R04",
    nome: "Notificação Final",
    canal: "email",
    prazo: 60,
    template: "AVISO DE ENCAMINHAMENTO: {nome}, sua dívida de R$ {valor} será encaminhada para negativação em 72h.",
    ativa: false,
    devedores: 143,
    taxaEntrega: "—",
  },
]

const devedoresPipeline = [
  { nome: "Fernanda Assunção", cpf: "823.***.***.12", valor: "R$ 3.420,00", dias: 5, canal: "email", status: "aguardando" },
  { nome: "Marcos Tinoco ME", cpf: "22.487.***/0001-44", valor: "R$ 18.750,00", dias: 5, canal: "email", status: "aguardando" },
  { nome: "Rita Schommer", cpf: "512.***.***.88", valor: "R$ 890,00", dias: 5, canal: "email", status: "enviado" },
  { nome: "Cooperativa Alfa Ltda", cpf: "07.321.***/0001-19", valor: "R$ 42.100,00", dias: 15, canal: "sms", status: "falha" },
  { nome: "Paulo Rizzatto", cpf: "941.***.***.03", valor: "R$ 2.150,00", dias: 15, canal: "sms", status: "aguardando" },
]

const statusColor: Record<string, string> = {
  aguardando: "#64748B",
  enviado: "#10B981",
  falha: "#EF4444",
}

export default function ReguaCobranca() {
  const [regras, setRegras] = useState(initialRegras)
  const [selectedId, setSelectedId] = useState("R01")

  const toggle = (id: string) => {
    setRegras((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ativa: !r.ativa } : r))
    )
  }

  const selected = regras.find((r) => r.id === selectedId)

  return (
    <div className="p-7 overflow-y-auto h-full">
      <div className="mb-7 flex items-start justify-between">
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, color: "var(--foreground)" }}>
            Régua de Cobrança
          </h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>
            Configure os canais, prazos e templates de comunicação por perfil de devedor.
          </p>
        </div>
        <button
          className="px-4 py-2.5 rounded font-medium"
          style={{ background: "var(--primary)", color: "#fff", fontSize: 13, fontFamily: "var(--font-display)", fontWeight: 600 }}
        >
          + Nova Regra
        </button>
      </div>

      {/* Rule cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {regras.map((r) => {
          const active = selectedId === r.id
          return (
            <div
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className="rounded p-4 cursor-pointer transition-all"
              style={{
                background: "var(--card)",
                border: `1px solid ${active ? canalColor[r.canal] : "var(--border)"}`,
                boxShadow: active ? `0 0 0 1px ${canalColor[r.canal]}30` : "none",
                opacity: r.ativa ? 1 : 0.55,
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    fontWeight: 700,
                    color: canalColor[r.canal],
                    background: `${canalColor[r.canal]}15`,
                    border: `1px solid ${canalColor[r.canal]}30`,
                    padding: "2px 7px",
                    borderRadius: 3,
                  }}
                >
                  {canalLabel[r.canal].toUpperCase()}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); toggle(r.id) }}
                  style={{
                    width: 32,
                    height: 18,
                    borderRadius: 9,
                    background: r.ativa ? "var(--accent)" : "var(--secondary)",
                    border: "none",
                    position: "relative",
                    cursor: "pointer",
                    transition: "background 0.2s",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 2,
                      left: r.ativa ? 14 : 2,
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: "#fff",
                      transition: "left 0.2s",
                    }}
                  />
                </button>
              </div>

              <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13, color: "var(--foreground)", marginBottom: 4 }}>
                {r.nome}
              </p>
              <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 12, fontFamily: "var(--font-mono)" }}>
                D+{r.prazo}
              </p>

              <div className="flex items-center justify-between">
                <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                  <span style={{ color: "var(--foreground)", fontWeight: 600 }}>{r.devedores}</span> devedores
                </span>
                <span style={{ fontSize: 11, color: canalColor[r.canal], fontFamily: "var(--font-mono)" }}>
                  {r.taxaEntrega}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Detail + pipeline */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1.6fr" }}>
        {/* Template detail */}
        {selected && (
          <div className="rounded p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-4">
              <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14, color: "var(--foreground)" }}>
                {selected.nome}
              </p>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted-foreground)" }}>
                {selected.id}
              </span>
            </div>

            <div className="space-y-3 mb-4">
              {[
                { label: "Canal", value: canalLabel[selected.canal] },
                { label: "Prazo", value: `D+${selected.prazo} (${selected.prazo} dias após vencimento)` },
                { label: "Status", value: selected.ativa ? "Ativa" : "Pausada" },
              ].map((f) => (
                <div key={f.label} className="flex items-center justify-between py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{f.label}</span>
                  <span
                    style={{
                      fontSize: 12,
                      color: f.label === "Status"
                        ? selected.ativa ? "var(--accent)" : "var(--muted-foreground)"
                        : "var(--foreground)",
                      fontFamily: f.label === "Prazo" ? "var(--font-mono)" : "var(--font-sans)",
                    }}
                  >
                    {f.value}
                  </span>
                </div>
              ))}
            </div>

            <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "var(--font-mono)" }}>
              Template de mensagem
            </p>
            <div
              className="p-3 rounded"
              style={{ background: "var(--muted)", border: "1px solid var(--border-strong)", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--foreground)", lineHeight: 1.6 }}
            >
              {selected.template}
            </div>

            <div className="flex gap-2 mt-4">
              <button
                className="flex-1 py-2 rounded text-sm"
                style={{ background: "var(--secondary)", color: "var(--foreground)", fontSize: 12 }}
              >
                Editar Regra
              </button>
              <button
                className="px-4 py-2 rounded text-sm"
                style={{ background: "rgba(239,68,68,0.1)", color: "var(--danger)", fontSize: 12, border: "1px solid rgba(239,68,68,0.2)" }}
              >
                Excluir
              </button>
            </div>
          </div>
        )}

        {/* Pipeline table */}
        <div className="rounded overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14, color: "var(--foreground)" }}>
              Devedores no pipeline de disparo
            </p>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
              Próximos disparos programados para hoje, 08h00 BRT
            </p>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Devedor", "Valor", "D+", "Canal", "Status"].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left"
                    style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.04em" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {devedoresPipeline.map((d, i) => (
                <tr
                  key={i}
                  style={{ borderBottom: i < devedoresPipeline.length - 1 ? "1px solid var(--border)" : "none" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)" }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent" }}
                >
                  <td className="px-5 py-3.5">
                    <p style={{ fontSize: 13, color: "var(--foreground)", fontWeight: 500 }}>{d.nome}</p>
                    <p style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}>{d.cpf}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--foreground)" }}>{d.valor}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted-foreground)" }}>+{d.dias}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      style={{
                        fontSize: 11,
                        fontFamily: "var(--font-mono)",
                        color: canalColor[d.canal],
                        background: `${canalColor[d.canal]}15`,
                        padding: "2px 6px",
                        borderRadius: 3,
                      }}
                    >
                      {canalLabel[d.canal]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      style={{
                        fontSize: 11,
                        fontFamily: "var(--font-mono)",
                        color: statusColor[d.status],
                        textTransform: "capitalize",
                      }}
                    >
                      {d.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
