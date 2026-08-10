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

const recentJobs = [
  { id: "JOB-0291", lote: "Lote Julho — Cooperativa SC", status: "concluído", disparos: 342, taxa: "94.7%", inicio: "29/07 08:12" },
  { id: "JOB-0290", lote: "Retentativa — Falhas SMS", status: "concluído", disparos: 28, taxa: "100%", inicio: "29/07 07:55" },
  { id: "JOB-0289", lote: "Lote Julho — Clínicas RS", status: "falha parcial", disparos: 187, taxa: "81.3%", inicio: "28/07 20:01" },
  { id: "JOB-0288", lote: "WhatsApp — 30 dias vencidos", status: "concluído", disparos: 156, taxa: "97.4%", inicio: "28/07 14:30" },
  { id: "JOB-0287", lote: "Lembrete — 5 dias a vencer", status: "concluído", disparos: 521, taxa: "98.1%", inicio: "28/07 08:00" },
]

// Mapeamento de estilos para os badges de status usando Tailwind
const statusStyles: Record<string, string> = {
  "concluído": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "falha parcial": "bg-amber-50 text-amber-700 border-amber-200",
  "em execução": "bg-blue-50 text-blue-700 border-blue-200",
  "aguardando": "bg-slate-50 text-slate-700 border-slate-200",
}

// Cores base para o gráfico (Tailwind hex)
const colors = {
  email: "#2563eb", // blue-600
  sms: "#8b5cf6",   // violet-500
  whatsapp: "#10b981" // emerald-500
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      // Sombra suavizada no Tooltip do gráfico
      <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-lg shadow-slate-200/50">
        <p className="text-xs font-semibold text-slate-500 mb-2">{label}</p>
        <div className="space-y-1">
          {payload.map((p: any) => (
            <p key={p.name} className="text-sm font-medium flex items-center gap-2 text-slate-700">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
              {p.name}: <span className="font-bold">{p.value}</span>
            </p>
          ))}
        </div>
      </div>
    )
  }
  return null
}

export default function Dashboard() {
  return (
    <div className="p-6 sm:p-8 space-y-8 bg-slate-50 min-h-screen font-sans">
      
      {/* --- HEADER --- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Dashboard Geral
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Quarta-feira, 30 de julho de 2026 · Próximo job em <span className="font-mono font-medium text-slate-700">00:48:13</span>
          </p>
        </div>
        <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 self-start sm:self-auto">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-semibold text-emerald-700 tracking-wide uppercase">
            Sistemas Operacionais
          </span>
        </div>
      </div>

      {/* --- KPIs GRID --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* KPI 1 */}
        {/* Sombra suavizada */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm shadow-slate-200/50">
          <div className="flex items-start justify-between mb-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total de Devedores</p>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900 mb-1">2.847</p>
          <p className="text-xs font-medium text-emerald-600 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
            +134 esta semana
          </p>
        </div>

        {/* KPI 2 */}
        {/* Sombra suavizada */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm shadow-slate-200/50">
          <div className="flex items-start justify-between mb-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Disparos Hoje</p>
            <div className="p-2 bg-violet-50 text-violet-600 rounded-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900 mb-1">342</p>
          <p className="text-xs font-medium text-slate-500">de 380 programados</p>
        </div>

        {/* KPI 3 */}
        {/* Sombra suavizada */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm shadow-slate-200/50">
          <div className="flex items-start justify-between mb-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Taxa de Entrega</p>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900 mb-1">94.7%</p>
          <p className="text-xs font-medium text-emerald-600 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
            +1.2pp vs. ontem
          </p>
        </div>

        {/* KPI 4 */}
        {/* Sombra suavizada */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm shadow-slate-200/50">
          <div className="flex items-start justify-between mb-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Falhas / Bounces</p>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900 mb-1">18</p>
          <p className="text-xs font-medium text-rose-600 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
            3 requerem ação manual
          </p>
        </div>
      </div>

      {/* --- MAIN CONTENT GRID --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* GRÁFICO (Ocupa 2 colunas no desktop) */}
        {/* Sombra suavizada no container do gráfico */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm shadow-slate-200/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Volume de Disparos</h2>
              <p className="text-xs text-slate-500 mt-1">E-mail, SMS e WhatsApp agregados nos últimos 7 dias</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                <span className="text-xs font-medium text-slate-600">E-mail</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-violet-500" />
                <span className="text-xs font-medium text-slate-600">SMS</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-xs font-medium text-slate-600">WhatsApp</span>
              </div>
            </div>
          </div>
          
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorEmail" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.email} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={colors.email} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorSms" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.sms} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={colors.sms} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorWpp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.whatsapp} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={colors.whatsapp} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="dia" 
                  tick={{ fontSize: 12, fill: "#64748b" }} 
                  axisLine={false} 
                  tickLine={false} 
                  dy={10}
                />
                <YAxis 
                  tick={{ fontSize: 12, fill: "#64748b" }} 
                  axisLine={false} 
                  tickLine={false} 
                  dx={-10}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="email" name="E-mail" stroke={colors.email} strokeWidth={2} fill="url(#colorEmail)" />
                <Area type="monotone" dataKey="sms" name="SMS" stroke={colors.sms} strokeWidth={2} fill="url(#colorSms)" />
                <Area type="monotone" dataKey="whatsapp" name="WhatsApp" stroke={colors.whatsapp} strokeWidth={2} fill="url(#colorWpp)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ALERTAS (Ocupa 1 coluna no desktop) */}
        {/* Sombra suavizada no container de alertas */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm shadow-slate-200/50 flex flex-col h-[380px] lg:h-auto">
          <h2 className="text-base font-bold text-slate-900 mb-6">Alertas do Sistema</h2>
          <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
            {[
              { level: "erro", msg: "JOB-0289: 34 bounces no lote Clínicas RS", time: "08:01" },
              { level: "aviso", msg: "Provedor SMS: latência acima de 800ms", time: "07:44" },
              { level: "aviso", msg: "3 CPFs duplicados removidos do lote", time: "07:30" },
              { level: "info", msg: "Régua ativada: Lembrete 5 dias", time: "06:00" },
              { level: "info", msg: "Job JOB-0287 concluído com 98.1%", time: "05:42" },
              { level: "info", msg: "Sistema: backup diário concluído", time: "03:00" },
            ].map((a, i) => (
              <div key={i} className="flex gap-3 items-start pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                  a.level === 'erro' ? 'bg-rose-500' : a.level === 'aviso' ? 'bg-amber-500' : 'bg-blue-500'
                }`} />
                <div className="flex-1">
                  <p className="text-sm text-slate-700 leading-snug">{a.msg}</p>
                  <span className="text-xs text-slate-400 mt-1 block">{a.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* --- TABELA DE JOBS RECENTES --- */}
      {/* Sombra suavizada na tabela */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm shadow-slate-200/50 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Jobs Recentes</h2>
          <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md">Últimas 24h</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50/50">
              <tr>
                {["Job ID", "Lote / Campanha", "Status", "Disparos", "Taxa", "Início"].map((h) => (
                  <th key={h} className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentJobs.map((job) => (
                <tr key={job.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs font-medium text-blue-600">
                    {job.id}
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-800">
                    {job.lote}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${statusStyles[job.status]}`}>
                      {job.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                    {job.disparos}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`font-mono text-xs font-semibold ${parseFloat(job.taxa) >= 90 ? "text-emerald-600" : "text-amber-600"}`}>
                      {job.taxa}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                    {job.inicio}
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