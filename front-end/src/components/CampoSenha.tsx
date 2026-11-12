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
          className="absolute inset-y-0 right-2 my-auto h-7 px-2 rounded-md text-[11px] font-bold text-slate-500 hover:text-black hover:bg-slate-100"
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
          className="px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-black whitespace-nowrap"
        >
          Gerar senha
        </button>
      )}
    </div>
  )
}
