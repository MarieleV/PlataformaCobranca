import { useState, useEffect, useRef } from "react"

interface LogEntry {
  id: number
  ts: string
  level: "INFO" | "WARN" | "ERROR" | "DEBUG" | "OK"
  source: string
  msg: string
}

const initialLogs: LogEntry[] = [
  { id: 1, ts: "08:12:01.003", level: "INFO", source: "scheduler", msg: "Celery Beat iniciado. Próximo job: JOB-0292 às 08:13:00" },
  { id: 2, ts: "08:12:01.041", level: "INFO", source: "worker-01", msg: "Worker online. Queue: cobranças_email. Concurrency: 8" },
  { id: 3, ts: "08:12:01.098", level: "INFO", source: "worker-02", msg: "Worker online. Queue: cobranças_sms. Concurrency: 4" },
  { id: 4, ts: "08:12:15.220", level: "DEBUG", source: "api", msg: "GET /api/v1/devedores?status=em_cobranca → 200 OK [12ms]" },
  { id: 5, ts: "08:12:30.441", level: "INFO", source: "scheduler", msg: "JOB-0292 enfileirado. 342 devedores elegíveis para disparo e-mail D+5" },
  { id: 6, ts: "08:12:30.892", level: "INFO", source: "worker-01", msg: "Processando devedor D-3847 (Fernanda Assunção) — enviando e-mail via SendGrid" },
  { id: 7, ts: "08:12:31.104", level: "OK", source: "sendgrid", msg: "202 Accepted · msg_id: SG.3847.xK9L · D-3847" },
  { id: 8, ts: "08:12:31.218", level: "INFO", source: "worker-01", msg: "Processando devedor D-3846 (Marcos Tinoco ME) — enviando e-mail via SendGrid" },
  { id: 9, ts: "08:12:31.445", level: "OK", source: "sendgrid", msg: "202 Accepted · msg_id: SG.3846.mR2P · D-3846" },
  { id: 10, ts: "08:12:32.009", level: "WARN", source: "sendgrid", msg: "Latência acima do normal: 824ms para D-3844. Retentativa em 30min se bounce." },
  { id: 11, ts: "08:12:32.441", level: "INFO", source: "worker-01", msg: "48 e-mails disparados. Aguardando webhooks de delivery." },
  { id: 12, ts: "08:12:45.001", level: "DEBUG", source: "api", msg: "POST /api/v1/batches/upload → 200 OK [44ms]" },
  { id: 13, ts: "08:12:45.112", level: "INFO", source: "rabbitmq", msg: "Mensagem publicada na fila batch_validation. ID: batch-2026-07-30-002" },
  { id: 14, ts: "08:12:45.890", level: "INFO", source: "worker-03", msg: "Iniciando validação Pandas: batch-2026-07-30-002 (3.248 registros)" },
  { id: 15, ts: "08:12:52.003", level: "ERROR", source: "worker-03", msg: "Linha 12: CPF 123.456.789-00 falhou validação RN04 — dígito verificador inválido" },
  { id: 16, ts: "08:12:52.114", level: "ERROR", source: "worker-03", msg: "Linha 47: valor_divida = -350.00 rejeitado — RN-VAL violado" },
  { id: 17, ts: "08:12:58.772", level: "OK", source: "worker-03", msg: "Validação concluída. 3.241 registros importados / 7 rejeitados / 1 aviso" },
  { id: 18, ts: "08:13:00.000", level: "INFO", source: "scheduler", msg: "Tick. Avaliando jobs pendentes…" },
]

const newLogPool: Omit<LogEntry, "id">[] = [
  { ts: "", level: "DEBUG", source: "api", msg: "GET /api/v1/jobs?limit=10 → 200 OK [8ms]" },
  { ts: "", level: "OK", source: "sendgrid", msg: "Webhook: delivery confirmado para D-3845 (Rita Schommer)" },
  { ts: "", level: "INFO", source: "worker-01", msg: "Processando devedor D-3843 (Paulo Rizzatto) — enviando SMS via Twilio" },
  { ts: "", level: "OK", source: "twilio", msg: "queued · SID: SM3843abcdef · D-3843" },
  { ts: "", level: "WARN", source: "redis", msg: "Uso de memória: 78%. Considere aumentar limite." },
  { ts: "", level: "INFO", source: "scheduler", msg: "Próximo job: WhatsApp D+30 em 00:47:00" },
  { ts: "", level: "DEBUG", source: "api", msg: "POST /api/v1/auth/refresh → 200 OK [3ms]" },
  { ts: "", level: "OK", source: "sendgrid", msg: "Webhook: delivery confirmado para D-3846 (Marcos Tinoco ME)" },
  { ts: "", level: "ERROR", source: "twilio", msg: "Falha ao enviar SMS para D-3844: número inválido +5500000000. Reagendando." },
  { ts: "", level: "INFO", source: "worker-02", msg: "Retentativa agendada: D-3844 em 30 minutos (1/3)" },
]

const activeFilterStyles: Record<string, string> = {
  todos: "bg-black text-white border-black shadow-sm shadow-black/10",
  INFO: "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-600/20",
  OK: "bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-600/20",
  WARN: "bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-500/20",
  ERROR: "bg-rose-600 text-white border-rose-600 shadow-sm shadow-rose-600/20",
  DEBUG: "bg-neutral-600 text-white border-neutral-600 shadow-sm",
}

// Cores pastéis e elegantes para o fundo preto
const termTagColor: Record<string, string> = {
  INFO: "text-blue-400",
  WARN: "text-amber-400",
  ERROR: "text-rose-400",
  DEBUG: "text-neutral-400",
  OK: "text-emerald-400",
}

const termMsgColor: Record<string, string> = {
  INFO: "text-neutral-200",
  WARN: "text-amber-100",
  ERROR: "text-rose-100",
  DEBUG: "text-neutral-400",
  OK: "text-emerald-100",
}

function now() {
  return new Date().toLocaleTimeString("pt-BR", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }) + "." + String(Date.now() % 1000).padStart(3, "0")
}

export default function Monitoramento() {
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs)
  const [running, setRunning] = useState(true)
  const [filter, setFilter] = useState<string>("todos")
  const termRef = useRef<HTMLDivElement>(null)
  const idRef = useRef(initialLogs.length + 1)
  const poolRef = useRef(0)

  useEffect(() => {
    if (!running) return
    const interval = setInterval(() => {
      const template = newLogPool[poolRef.current % newLogPool.length]
      poolRef.current++
      const entry: LogEntry = { ...template, id: idRef.current++, ts: now() }
      setLogs((prev) => [...prev.slice(-200), entry])
    }, 2200)
    return () => clearInterval(interval)
  }, [running])

  useEffect(() => {
    if (termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight
    }
  }, [logs])

  const displayed = filter === "todos" ? logs : logs.filter((l) => l.level === filter)

  return (
    <div className="p-4 md:p-6 xl:p-8 overflow-y-auto h-full bg-slate-50 font-sans">
      
      {/* --- HEADER & CONTROLS --- */}
      <div className="mb-6 flex flex-col xl:flex-row xl:items-start justify-between flex-shrink-0 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Monitoramento de Sistema
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Workers, filas e chamadas de APIs externas.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1.5 p-1 bg-white border border-slate-200 rounded-lg shadow-sm shadow-slate-200/50">
            {["todos", "INFO", "OK", "WARN", "ERROR", "DEBUG"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold font-mono transition-all border ${
                  filter === f
                    ? activeFilterStyles[f]
                    : "bg-transparent text-slate-500 border-transparent hover:bg-slate-100"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="h-8 w-px bg-slate-200 hidden sm:block mx-1"></div>

          <button
            onClick={() => setRunning((r) => !r)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold font-mono transition-all border shadow-sm shadow-slate-200/50 ${
              running 
                ? "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100" 
                : "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100"
            }`}
          >
            <span className="relative flex h-2 w-2">
              {running && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${running ? "bg-rose-500" : "bg-emerald-500"}`}></span>
            </span>
            {running ? "Pausar Live" : "Retomar Live"}
          </button>

          <button
            onClick={() => setLogs([])}
            className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-600 text-xs font-semibold font-mono hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm shadow-slate-200/50"
          >
            Limpar
          </button>
        </div>
      </div>

      {/* --- STATS BAR --- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 flex-shrink-0">
        {[
          { label: "Total Logs", value: logs.length, color: "text-slate-900", icon: "bg-slate-100 text-slate-600" },
          { label: "Sucesso (OK)", value: logs.filter((l) => l.level === "OK").length, color: "text-emerald-600", icon: "bg-emerald-50 text-emerald-600" },
          { label: "Avisos (WARN)", value: logs.filter((l) => l.level === "WARN").length, color: "text-amber-500", icon: "bg-amber-50 text-amber-500" },
          { label: "Erros (ERROR)", value: logs.filter((l) => l.level === "ERROR").length, color: "text-rose-600", icon: "bg-rose-50 text-rose-600" },
        ].map((s) => (
          <div
            key={s.label}
            className="px-5 py-4 rounded-2xl bg-white border border-slate-200/60 shadow-sm shadow-slate-200/50 flex items-center justify-between"
          >
            <div>
              <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{s.label}</span>
              <span className={`font-mono font-bold text-2xl ${s.color}`}>{s.value}</span>
            </div>
            <div className={`w-2 h-8 rounded-full ${s.icon.split(' ')[0]}`}></div>
          </div>
        ))}
      </div>

      {/* --- PROFESSIONAL LOG VIEWER (Dark Mode - Preto) --- */}
      <div className="flex-1 rounded-2xl bg-black border border-neutral-800 shadow-sm flex flex-col overflow-hidden">
        
        {/* Barra de Título */}
        <div className="px-5 py-3.5 bg-neutral-900/50 border-b border-neutral-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider font-sans">
              Console de Execução
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {running ? (
              <span className="text-emerald-400 text-xs font-medium flex items-center gap-1.5 font-sans bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Conectado
              </span>
            ) : (
              <span className="text-amber-400 text-xs font-medium flex items-center gap-1.5 font-sans bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                Pausado
              </span>
            )}
          </div>
        </div>

        {/* Área Rolável de Logs */}
        <div
          ref={termRef}
          className="flex-1 overflow-y-auto p-5 font-mono text-[13px] leading-relaxed custom-scrollbar bg-[#0a0a0a]"
        >
          <div className="space-y-1">
            {displayed.map((log) => (
              <div
                key={log.id}
                className="flex flex-col sm:flex-row gap-x-4 gap-y-1 hover:bg-neutral-800/50 rounded px-2 -mx-2 py-1 transition-colors group"
              >
                {/* Timestamp */}
                <span className="text-neutral-500 flex-shrink-0 w-28 group-hover:text-neutral-400 transition-colors">
                  {log.ts}
                </span>
                
                {/* Badge Level */}
                <span className={`${termTagColor[log.level]} flex-shrink-0 w-12 font-bold`}>
                  {log.level}
                </span>
                
                {/* Source (Serviço/Worker) */}
                <span className="text-neutral-600 flex-shrink-0 w-28 truncate">
                  [{log.source}]
                </span>
                
                {/* Mensagem */}
                <span className={`${termMsgColor[log.level]} flex-1 break-words font-medium tracking-wide`}>
                  {log.msg}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
    </div>
  )
}