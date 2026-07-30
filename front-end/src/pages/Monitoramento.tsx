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
  { ts: "", level: "INFO", source: "worker-02", msg: "Retentatva agendada: D-3844 em 30 minutos (1/3)" },
]

const levelColor: Record<string, string> = {
  INFO: "#3B82F6",
  WARN: "#F59E0B",
  ERROR: "#EF4444",
  DEBUG: "#64748B",
  OK: "#10B981",
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
    <div className="p-7 flex flex-col h-full overflow-hidden">
      <div className="mb-5 flex items-start justify-between flex-shrink-0">
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, color: "var(--foreground)" }}>
            Monitoramento
          </h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>
            Log de sistema em tempo real — workers, filas, APIs externas
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Level filters */}
          <div className="flex gap-1">
            {["todos", "INFO", "OK", "WARN", "ERROR", "DEBUG"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-2.5 py-1 rounded text-xs transition-all"
                style={{
                  fontFamily: "var(--font-mono)",
                  background: filter === f ? (levelColor[f] || "var(--primary)") : "var(--card)",
                  color: filter === f ? "#fff" : levelColor[f] || "var(--muted-foreground)",
                  border: `1px solid ${filter === f ? (levelColor[f] || "var(--primary)") : "var(--border-strong)"}`,
                  opacity: filter === f ? 1 : 0.7,
                }}
              >
                {f}
              </button>
            ))}
          </div>

          <button
            onClick={() => setRunning((r) => !r)}
            className="flex items-center gap-2 px-3 py-2 rounded transition-all"
            style={{
              background: running ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)",
              border: `1px solid ${running ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)"}`,
              color: running ? "var(--danger)" : "var(--accent)",
              fontSize: 12,
              fontFamily: "var(--font-mono)",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: running ? "var(--danger)" : "var(--accent)",
                display: "inline-block",
              }}
            />
            {running ? "Pausar" : "Retomar"}
          </button>

          <button
            onClick={() => setLogs([])}
            className="px-3 py-2 rounded"
            style={{ background: "var(--card)", border: "1px solid var(--border-strong)", fontSize: 12, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}
          >
            Limpar
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3 mb-4 flex-shrink-0">
        {[
          { label: "Total", value: logs.length, color: "var(--foreground)" },
          { label: "OK", value: logs.filter((l) => l.level === "OK").length, color: "var(--accent)" },
          { label: "WARN", value: logs.filter((l) => l.level === "WARN").length, color: "var(--warning)" },
          { label: "ERROR", value: logs.filter((l) => l.level === "ERROR").length, color: "var(--danger)" },
        ].map((s) => (
          <div
            key={s.label}
            className="px-4 py-3 rounded flex items-center justify-between"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <span style={{ fontSize: 12, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}>{s.label}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 18, color: s.color }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Terminal */}
      <div
        ref={termRef}
        className="rounded flex-1 overflow-y-auto p-4"
        style={{
          background: "#060A0F",
          border: "1px solid var(--border-strong)",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          lineHeight: 1.8,
          minHeight: 0,
        }}
      >
        <div style={{ marginBottom: 8, color: "#3B82F6", fontSize: 11 }}>
          # Plataforma de Cobrança Automatizada — System Log · {running ? "● LIVE" : "⏸ PAUSED"}
        </div>
        {displayed.map((log) => (
          <div
            key={log.id}
            className="flex gap-3"
            style={{ paddingBottom: 1 }}
          >
            <span style={{ color: "#475569", flexShrink: 0, width: 96 }}>{log.ts}</span>
            <span
              style={{
                color: levelColor[log.level],
                flexShrink: 0,
                width: 44,
                fontWeight: 700,
              }}
            >
              {log.level}
            </span>
            <span style={{ color: "#64748B", flexShrink: 0, width: 90 }}>[{log.source}]</span>
            <span
              style={{
                color:
                  log.level === "ERROR"
                    ? "#FCA5A5"
                    : log.level === "WARN"
                    ? "#FCD34D"
                    : log.level === "OK"
                    ? "#6EE7B7"
                    : "#94A3B8",
                flex: 1,
              }}
            >
              {log.msg}
            </span>
          </div>
        ))}
        {running && (
          <div style={{ color: "#3B82F6", marginTop: 4 }}>
            <span style={{ animation: "none" }}>█</span>
          </div>
        )}
      </div>
    </div>
  )
}
