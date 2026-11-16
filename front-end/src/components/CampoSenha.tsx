import { useState } from "react"
import { gerarSenha } from "../lib/usuarios"
import { inputClasse } from "./estilos"

/** Input de senha com "mostrar" e, opcionalmente, "gerar senha" (que já deixa visível para copiar). */
export default function CampoSenha({ valor, onChange, erro, autoComplete = "new-password", permitirGerar = false, autoFocus = false, rotuloAria }: {
  valor: string
  onChange: (v: string) => void
  erro?: string | null
  autoComplete?: "new-password" | "current-password"
  permitirGerar?: boolean
  autoFocus?: boolean
  rotuloAria?: string
}) {
  const [visivel, setVisivel] = useState(false)
  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <input
          type={visivel ? "text" : "password"}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          aria-label={rotuloAria}
          maxLength={128}
          className={`${inputClasse(erro)} pr-16 ${visivel ? "font-mono" : ""}`}
        />
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          className="absolute inset-y-0 right-1.5 my-auto h-7 px-2 rounded-md text-xs font-medium text-slate-600 hover:text-slate-950 hover:bg-slate-100"
        >
          {visivel ? "Ocultar" : "Mostrar"}
        </button>
      </div>
      {permitirGerar && (
        <button
          type="button"
          onClick={() => {
            onChange(gerarSenha())
            setVisivel(true)
          }}
          className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-950 whitespace-nowrap"
        >
          Gerar senha
        </button>
      )}
    </div>
  )
}
