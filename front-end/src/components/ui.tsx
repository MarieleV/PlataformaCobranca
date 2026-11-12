// Componentes visuais pequenos, compartilhados entre as telas.

import { useEffect, type ReactNode } from "react"

export function Badge({ texto, classe }: { texto: string; classe: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${classe}`}>
      {texto}
    </span>
  )
}

/** Card branco com cabeçalho (título + ação opcional à direita). */
export function Painel({ titulo, subtitulo, acao, children }: {
  titulo: ReactNode
  subtitulo?: ReactNode
  acao?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm shadow-slate-200/50 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">{titulo}</h2>
          {subtitulo && <p className="text-xs text-slate-500 mt-0.5">{subtitulo}</p>}
        </div>
        {acao}
      </div>
      {children}
    </div>
  )
}

/** Faixa vermelha de erro com botão opcional de "Tentar novamente". */
export function AvisoErro({ mensagem, onTentarNovamente }: { mensagem: ReactNode; onTentarNovamente?: () => void }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-rose-50 border border-rose-100 rounded-2xl" role="alert">
      <p className="text-sm font-semibold text-rose-700">{mensagem}</p>
      {onTentarNovamente && (
        <button
          onClick={onTentarNovamente}
          className="self-start sm:self-auto px-3 py-1.5 rounded-lg text-xs font-bold text-rose-700 bg-white border border-rose-200 hover:bg-rose-100 transition-colors"
        >
          Tentar novamente
        </button>
      )}
    </div>
  )
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  )
}

/** Fecha com Esc. Use para painéis e modais. */
export function useFecharComEsc(onFechar: () => void, ativo = true) {
  useEffect(() => {
    if (!ativo) return
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar()
    }
    window.addEventListener("keydown", tecla)
    return () => window.removeEventListener("keydown", tecla)
  }, [onFechar, ativo])
}

/** Modal centralizado (confirmações). Fecha no Esc e no clique fora, exceto enquanto `ocupado`. */
export function Modal({ titulo, children, onFechar, ocupado = false }: {
  titulo: string
  children: ReactNode
  onFechar: () => void
  ocupado?: boolean
}) {
  useFecharComEsc(onFechar, !ocupado)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]" onClick={ocupado ? undefined : onFechar} />
      <div role="dialog" aria-modal="true" aria-label={titulo} className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-3">{titulo}</h2>
        {children}
      </div>
    </div>
  )
}

export const BOTAO_PRIMARIO =
  "px-4 py-2.5 rounded-xl bg-black hover:bg-slate-900 text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
export const BOTAO_SECUNDARIO =
  "px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
export const BOTAO_PERIGO =
  "px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"

export const ICONE_DOWNLOAD = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
)
