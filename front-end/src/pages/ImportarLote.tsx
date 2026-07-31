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
    <div className="p-6 sm:p-8 overflow-y-auto h-full bg-slate-50 font-sans">
      
      {/* --- HEADER --- */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Importar Lote de Devedores
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Faça upload de arquivos CSV ou Excel (.xlsx). O processamento é assíncrono com feedback em tempo real.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* --- UPLOAD AREA (Spans 7 columns) --- */}
        <div className="lg:col-span-7 space-y-4">
          {phase === "idle" && (
            <div
              className={`rounded-2xl flex flex-col items-center justify-center text-center transition-all cursor-pointer p-10 bg-white border-2 border-dashed shadow-sm min-h-[320px] ${
                dragging
                  ? "border-blue-600 bg-blue-50/40"
                  : "border-slate-300 hover:border-slate-400"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
            >
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 shadow-sm">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <p className="font-bold text-slate-900 text-base mb-1">
                Arraste o arquivo aqui
              </p>
              <p className="text-sm text-slate-500 mb-6">
                ou clique para selecionar do computador
              </p>
              <span className="font-mono text-xs font-semibold text-slate-400 bg-slate-100 px-3 py-1 rounded-md">
                CSV · XLSX · máx 50.000 registros · 20MB
              </span>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          )}

          {(phase === "uploading" || phase === "processing") && (
            <div className="rounded-2xl bg-white p-8 flex flex-col items-center justify-center border border-slate-200/60 shadow-sm min-h-[320px]">
              <div className="flex items-center gap-2 font-mono text-xs font-semibold text-slate-500 mb-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                </span>
                {phase === "uploading" ? "Enviando arquivo..." : "Processando registros..."}
              </div>
              
              <p className="font-bold text-slate-900 text-base mb-6">
                {fileName}
              </p>

              <div className="w-full max-w-sm space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="font-semibold text-slate-500">
                    {phase === "uploading" ? "Upload" : "Validação Pandas"}
                  </span>
                  <span className="font-bold text-blue-600">
                    {Math.round(progress)}%
                  </span>
                </div>
                
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-150 shadow-sm"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {phase === "processing" && (
                <p className="font-mono text-xs text-slate-400 mt-6 animate-pulse">
                  Aplicando regras RN01–RN04 linha a linha…
                </p>
              )}
            </div>
          )}

          {phase === "done" && (
            <div className="rounded-2xl bg-white p-8 flex flex-col items-center justify-center text-center border border-emerald-200 shadow-sm min-h-[320px]">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 shadow-sm">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              <p className="font-bold text-slate-900 text-xl mb-1">
                Arquivo processado!
              </p>
              <p className="text-sm text-slate-500 mb-8 font-medium">
                {fileName} · <span className="font-mono text-slate-700 font-bold">3.248 registros analisados</span>
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
                <button
                  onClick={onValidated}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-sm shadow-emerald-600/20 transition-all"
                >
                  Ver Relatório de Validação
                </button>
                <button
                  onClick={reset}
                  className="px-5 py-3 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-sm transition-all shadow-sm"
                >
                  Novo upload
                </button>
              </div>
            </div>
          )}
        </div>

        {/* --- RULES + TEMPLATE SIDEBAR (Spans 5 columns) --- */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Colunas Obrigatórias */}
          <div className="rounded-2xl bg-white p-6 border border-slate-200/60 shadow-sm">
            <h2 className="font-bold text-slate-900 text-base mb-4">
              Colunas obrigatórias
            </h2>
            <div className="space-y-3">
              {[
                { col: "cpf_cnpj", desc: "CPF (11 dígitos) ou CNPJ (14 dígitos)" },
                { col: "nome_devedor", desc: "Nome completo ou razão social" },
                { col: "email", desc: "E-mail válido para disparo" },
                { col: "telefone", desc: "DDD + número (WhatsApp / SMS)" },
                { col: "valor_divida", desc: "Valor em reais (ex: 1250.00)" },
                { col: "data_vencimento", desc: "Formato DD/MM/AAAA" },
              ].map((c) => (
                <div key={c.col} className="flex items-start gap-3">
                  <span className="font-mono text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 flex-shrink-0 mt-0.5">
                    {c.col}
                  </span>
                  <p className="text-xs text-slate-600 leading-relaxed">{c.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Regras de Validação */}
          <div className="rounded-2xl bg-white p-6 border border-slate-200/60 shadow-sm">
            <h2 className="font-bold text-slate-900 text-base mb-4">
              Regras de validação
            </h2>
            <div className="space-y-2.5">
              {[
                "CPF/CNPJ inválido → linha rejeitada (RN04)",
                "Valor negativo → linha rejeitada",
                "E-mail malformado → aviso, não rejeita",
                "Linha duplicada → mantém mais recente",
                "Máximo 50.000 registros por arquivo",
              ].map((r, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="text-amber-500 font-bold text-sm flex-shrink-0">·</span>
                  <p className="text-xs text-slate-600 leading-relaxed">{r}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Baixar Planilha Modelo */}
          <button
            className="w-full py-3.5 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold font-mono transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Baixar Planilha Modelo (.xlsx)
          </button>

        </div>
      </div>
    </div>
  )
}