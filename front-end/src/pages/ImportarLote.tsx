import { useState, useRef } from "react"

type Phase = "idle" | "uploading" | "processing" | "done"

export default function ImportarLote({ onValidated }: { onValidated: () => void }) {
  const [phase, setPhase] = useState<Phase>("idle")
  const [progress, setProgress] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const startUpload = (name: string) => {
    setFileName(name)
    setPhase("uploading")
    setProgress(0)

    let p = 0
    const tick = setInterval(() => {
      p += Math.random() * 8 + 4
      if (p >= 100) {
        p = 100
        clearInterval(tick)
        setProgress(100)
        setPhase("processing")
        let p2 = 0
        const tick2 = setInterval(() => {
          p2 += Math.random() * 5 + 2
          if (p2 >= 100) {
            clearInterval(tick2)
            setPhase("done")
          }
          setProgress(Math.min(p2, 100))
        }, 80)
      }
      setProgress(Math.min(p, 100))
    }, 60)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) startUpload(file.name)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) startUpload(file.name)
  }

  const reset = () => {
    setPhase("idle")
    setProgress(0)
    setFileName("")
  }

  return (
    <div className="p-7 overflow-y-auto h-full">
      <div className="mb-7">
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, color: "var(--foreground)" }}>
          Importar Lote de Devedores
        </h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>
          Faça upload de arquivos CSV ou Excel (.xlsx). O processamento é assíncrono com feedback em tempo real.
        </p>
      </div>

      <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 320px" }}>
        {/* Upload area */}
        <div className="space-y-4">
          {phase === "idle" && (
            <div
              className="rounded flex flex-col items-center justify-center text-center transition-all cursor-pointer"
              style={{
                background: dragging ? "rgba(59,130,246,0.08)" : "var(--card)",
                border: `2px dashed ${dragging ? "var(--primary)" : "var(--border-strong)"}`,
                minHeight: 260,
                padding: "40px 24px",
              }}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 12,
                  background: "rgba(59,130,246,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                  fontSize: 24,
                }}
              >
                ↑
              </div>
              <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, color: "var(--foreground)", marginBottom: 8 }}>
                Arraste o arquivo aqui
              </p>
              <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 20 }}>
                ou clique para selecionar do computador
              </p>
              <p style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}>
                CSV · XLSX · máx 50.000 registros · 20MB
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
            </div>
          )}

          {(phase === "uploading" || phase === "processing") && (
            <div
              className="rounded p-8 flex flex-col items-center justify-center"
              style={{ background: "var(--card)", border: "1px solid var(--border)", minHeight: 260 }}
            >
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--muted-foreground)",
                  marginBottom: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--primary)",
                    display: "inline-block",
                    animation: "pulse 1s infinite",
                  }}
                />
                {phase === "uploading" ? "Enviando arquivo..." : "Processando registros..."}
              </div>
              <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14, color: "var(--foreground)", marginBottom: 20 }}>
                {fileName}
              </p>
              <div style={{ width: "100%", maxWidth: 360 }}>
                <div className="flex justify-between mb-2">
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}>
                    {phase === "uploading" ? "Upload" : "Validação Pandas"}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--primary)", fontFamily: "var(--font-mono)" }}>
                    {Math.round(progress)}%
                  </span>
                </div>
                <div style={{ height: 4, background: "var(--secondary)", borderRadius: 2, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${progress}%`,
                      background: "var(--primary)",
                      borderRadius: 2,
                      transition: "width 0.1s ease",
                      boxShadow: "0 0 8px var(--primary)",
                    }}
                  />
                </div>
              </div>
              {phase === "processing" && (
                <p style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)", marginTop: 16 }}>
                  Aplicando regras RN01–RN04 linha a linha…
                </p>
              )}
            </div>
          )}

          {phase === "done" && (
            <div
              className="rounded p-8 flex flex-col items-center justify-center text-center"
              style={{ background: "var(--card)", border: "1px solid rgba(16,185,129,0.2)", minHeight: 260 }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "rgba(16,185,129,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  color: "var(--accent)",
                  marginBottom: 16,
                }}
              >
                ✓
              </div>
              <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, color: "var(--foreground)", marginBottom: 4 }}>
                Arquivo processado!
              </p>
              <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 24 }}>
                {fileName} · 3.248 registros analisados
              </p>
              <div className="flex gap-3">
                <button
                  onClick={onValidated}
                  className="px-5 py-2.5 rounded font-medium"
                  style={{ background: "var(--accent)", color: "#fff", fontSize: 13, fontFamily: "var(--font-display)", fontWeight: 600 }}
                >
                  Ver Relatório de Validação
                </button>
                <button
                  onClick={reset}
                  className="px-5 py-2.5 rounded"
                  style={{ background: "var(--secondary)", color: "var(--foreground)", fontSize: 13 }}
                >
                  Novo upload
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Rules + template */}
        <div className="space-y-4">
          <div
            className="rounded p-5"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14, color: "var(--foreground)", marginBottom: 14 }}>
              Colunas obrigatórias
            </p>
            <div className="space-y-2.5">
              {[
                { col: "cpf_cnpj", desc: "CPF (11 dígitos) ou CNPJ (14 dígitos)" },
                { col: "nome_devedor", desc: "Nome completo ou razão social" },
                { col: "email", desc: "E-mail válido para disparo" },
                { col: "telefone", desc: "DDD + número (WhatsApp / SMS)" },
                { col: "valor_divida", desc: "Valor em reais (ex: 1250.00)" },
                { col: "data_vencimento", desc: "Formato DD/MM/AAAA" },
              ].map((c) => (
                <div key={c.col} className="flex items-start gap-3">
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--primary)",
                      background: "rgba(59,130,246,0.1)",
                      padding: "1px 6px",
                      borderRadius: 3,
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {c.col}
                  </span>
                  <p style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>{c.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div
            className="rounded p-5"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14, color: "var(--foreground)", marginBottom: 8 }}>
              Regras de validação
            </p>
            <div className="space-y-2">
              {[
                "CPF/CNPJ inválido → linha rejeitada (RN04)",
                "Valor negativo → linha rejeitada",
                "E-mail malformado → aviso, não rejeita",
                "Linha duplicada → mantém mais recente",
                "Máximo 50.000 registros por arquivo",
              ].map((r, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span style={{ color: "var(--warning)", fontSize: 12, flexShrink: 0 }}>·</span>
                  <p style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>{r}</p>
                </div>
              ))}
            </div>
          </div>

          <button
            className="w-full py-3 rounded flex items-center justify-center gap-2 transition-all"
            style={{ background: "var(--secondary)", color: "var(--foreground)", fontSize: 13, border: "1px solid var(--border-strong)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)" }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--secondary)" }}
          >
            <span>↓</span> Baixar Planilha Modelo (.xlsx)
          </button>
        </div>
      </div>
    </div>
  )
}
