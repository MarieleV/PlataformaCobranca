import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

const chartData = [
  { dia: "23/Jul", email: 312, sms: 148, whatsapp: 89 },
  { dia: "24/Jul", email: 428, sms: 201, whatsapp: 114 },
  { dia: "25/Jul", email: 389, sms: 167, whatsapp: 98 },
  { dia: "26/Jul", email: 521, sms: 243, whatsapp: 156 },
  { dia: "27/Jul", email: 461, sms: 218, whatsapp: 132 },
  { dia: "28/Jul", email: 598, sms: 287, whatsapp: 178 },
  { dia: "29/Jul", email: 342, sms: 156, whatsapp: 101 },
]

const kpis = [
  {
    label: "Total de Devedores",
    value: "2.847",
    sub: "+134 esta semana",
    color: "var(--primary)",
    icon: "⊙",
    trend: "up",
  },
  {
    label: "Disparos Hoje",
    value: "342",
    sub: "de 380 programados",
    color: "var(--accent)",
    icon: "↑",
    trend: "up",
  },
  {
    label: "Taxa de Entrega",
    value: "94.7%",
    sub: "+1.2pp vs. ontem",
    color: "#A78BFA",
    icon: "✓",
    trend: "up",
  },
  {
    label: "Falhas / Bounces",
    value: "18",
    sub: "3 requerem ação",
    color: "var(--danger)",
    icon: "⚠",
    trend: "down",
  },
]

const recentJobs = [
  { id: "JOB-0291", lote: "Lote Julho — Cooperativa SC", status: "concluído", disparos: 342, taxa: "94.7%", inicio: "29/07 08:12" },
  { id: "JOB-0290", lote: "Retentativa — Falhas SMS", status: "concluído", disparos: 28, taxa: "100%", inicio: "29/07 07:55" },
  { id: "JOB-0289", lote: "Lote Julho — Clínicas RS", status: "falha parcial", disparos: 187, taxa: "81.3%", inicio: "28/07 20:01" },
  { id: "JOB-0288", lote: "WhatsApp — 30 dias vencidos", status: "concluído", disparos: 156, taxa: "97.4%", inicio: "28/07 14:30" },
  { id: "JOB-0287", lote: "Lembrete — 5 dias a vencer", status: "concluído", disparos: 521, taxa: "98.1%", inicio: "28/07 08:00" },
]

const statusColor: Record<string, string> = {
  "concluído": "var(--accent)",
  "falha parcial": "var(--warning)",
  "em execução": "var(--primary)",
  "aguardando": "var(--muted-foreground)",
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border-strong)",
          borderRadius: 6,
          padding: "10px 14px",
          fontSize: 12,
          fontFamily: "var(--font-mono)",
        }}
      >
        <p style={{ color: "var(--muted-foreground)", marginBottom: 6 }}>{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color, marginBottom: 2 }}>
            {p.name}: {p.value}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export default function Dashboard() {
  return (
    <div className="p-7 space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, color: "var(--foreground)" }}
          >
            Dashboard
          </h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 2 }}>
            Quarta-feira, 30 de julho de 2026 · Próximo job em 00:48:13
          </p>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-2 rounded"
          style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "var(--accent)",
              display: "inline-block",
              boxShadow: "0 0 6px var(--accent)",
            }}
          />
          <span style={{ fontSize: 12, color: "var(--accent)", fontFamily: "var(--font-mono)", fontWeight: 500 }}>
            Sistema operacional
          </span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="p-5 rounded"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-start justify-between mb-3">
              <p style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {kpi.label}
              </p>
              <span style={{ fontSize: 16, color: kpi.color }}>{kpi.icon}</span>
            </div>
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 30,
                color: kpi.color,
                lineHeight: 1,
                marginBottom: 6,
              }}
            >
              {kpi.value}
            </p>
            <p style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Chart + Alerts */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 280px" }}>
        {/* Chart */}
        <div
          className="p-5 rounded"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14, color: "var(--foreground)" }}>
                Disparos — últimos 7 dias
              </p>
              <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
                E-mail, SMS e WhatsApp agregados por dia
              </p>
            </div>
            <div className="flex gap-4">
              {[
                { label: "E-mail", color: "#3B82F6" },
                { label: "SMS", color: "#A78BFA" },
                { label: "WhatsApp", color: "#10B981" },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: l.color, display: "inline-block" }} />
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}>
                    {l.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorEmail" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorSms" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#A78BFA" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#A78BFA" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorWpp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="dia"
                tick={{ fontSize: 11, fill: "#64748B", fontFamily: "var(--font-mono)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#64748B", fontFamily: "var(--font-mono)" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="email" name="E-mail" stroke="#3B82F6" strokeWidth={2} fill="url(#colorEmail)" dot={false} />
              <Area type="monotone" dataKey="sms" name="SMS" stroke="#A78BFA" strokeWidth={2} fill="url(#colorSms)" dot={false} />
              <Area type="monotone" dataKey="whatsapp" name="WhatsApp" stroke="#10B981" strokeWidth={2} fill="url(#colorWpp)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Alerts */}
        <div
          className="p-5 rounded flex flex-col"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14, color: "var(--foreground)", marginBottom: 14 }}>
            Alertas do Sistema
          </p>
          <div className="space-y-3 flex-1 overflow-y-auto">
            {[
              { level: "erro", msg: "JOB-0289: 34 bounces no lote Clínicas RS", time: "08:01" },
              { level: "aviso", msg: "Provedor SMS: latência acima de 800ms", time: "07:44" },
              { level: "aviso", msg: "3 CPFs duplicados removidos do lote", time: "07:30" },
              { level: "info", msg: "Régua ativada: Lembrete 5 dias", time: "06:00" },
              { level: "info", msg: "Job JOB-0287 concluído com 98.1%", time: "05:42" },
              { level: "info", msg: "Sistema: backup diário concluído", time: "03:00" },
            ].map((a, i) => (
              <div
                key={i}
                className="flex gap-3"
                style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10 }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    fontWeight: 700,
                    color:
                      a.level === "erro"
                        ? "var(--danger)"
                        : a.level === "aviso"
                        ? "var(--warning)"
                        : "var(--muted-foreground)",
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  {a.level.toUpperCase()}
                </span>
                <p style={{ fontSize: 12, color: "var(--secondary-foreground)", lineHeight: 1.5, flex: 1 }}>
                  {a.msg}
                </p>
                <span style={{ fontSize: 10, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>
                  {a.time}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent jobs */}
      <div
        className="rounded overflow-hidden"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14, color: "var(--foreground)" }}>
            Jobs Recentes
          </p>
          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Últimas 24h</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Job ID", "Lote / Campanha", "Status", "Disparos", "Taxa", "Início"].map((h) => (
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
            {recentJobs.map((job, i) => (
              <tr
                key={job.id}
                style={{
                  borderBottom: i < recentJobs.length - 1 ? "1px solid var(--border)" : "none",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)" }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent" }}
              >
                <td className="px-5 py-3.5">
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--primary)" }}>{job.id}</span>
                </td>
                <td className="px-5 py-3.5">
                  <span style={{ fontSize: 13, color: "var(--foreground)" }}>{job.lote}</span>
                </td>
                <td className="px-5 py-3.5">
                  <span
                    className="px-2 py-1 rounded-sm"
                    style={{
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                      color: statusColor[job.status],
                      background: `${statusColor[job.status]}15`,
                      border: `1px solid ${statusColor[job.status]}30`,
                    }}
                  >
                    {job.status}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--foreground)" }}>{job.disparos}</span>
                </td>
                <td className="px-5 py-3.5">
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: parseFloat(job.taxa) >= 90 ? "var(--accent)" : "var(--warning)",
                    }}
                  >
                    {job.taxa}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted-foreground)" }}>{job.inicio}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
