// Componentes visuais pequenos, compartilhados entre as telas.

import type { ReactNode, SelectHTMLAttributes } from "react"
import { useFecharComEsc } from "../hooks/useFecharComEsc"
import { SELECT, SUPERFICIE } from "./estilos"

/** Selo de status: fundo suave, ponto na cor do texto, sem borda. */
export function Badge({ texto, classe }: { texto: string; classe: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-md text-xs font-medium whitespace-nowrap ${classe}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" aria-hidden="true" />
      {texto}
    </span>
  )
}

/** Título da página, descrição e ações à direita — igual em todas as telas. */
export function CabecalhoPagina({ titulo, descricao, acoes }: {
  titulo: ReactNode
  descricao?: ReactNode
  acoes?: ReactNode
}) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-slate-950">{titulo}</h1>
        {descricao && <p className="mt-1 text-sm text-slate-500 max-w-[72ch]">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2 lg:justify-end">{acoes}</div>}
    </header>
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
    <section className={`${SUPERFICIE} overflow-hidden`}>
      <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-950">{titulo}</h2>
          {subtitulo && <p className="text-[13px] text-slate-500 mt-0.5">{subtitulo}</p>}
        </div>
        {acao}
      </div>
      {children}
    </section>
  )
}

/** Contagem discreta ao lado de um título: "Jobs da régua 12". */
export function Contagem({ valor }: { valor: string }) {
  return <span className="ml-1.5 align-middle inline-flex h-5 px-1.5 items-center rounded-md bg-slate-100 text-xs font-medium text-slate-600">{valor}</span>
}

type TipoAviso = "erro" | "sucesso" | "atencao" | "info"

const ESTILO_AVISO: Record<TipoAviso, { caixa: string; icone: ReactNode }> = {
  erro: {
    caixa: "bg-rose-50 border-rose-200 text-rose-800",
    icone: <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
  },
  sucesso: {
    caixa: "bg-emerald-50 border-emerald-200 text-emerald-800",
    icone: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
  },
  atencao: {
    caixa: "bg-amber-50 border-amber-200 text-amber-900",
    icone: <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.5m0 3.5h.01M10.3 4.2L2.6 17.5A2 2 0 004.3 20.5h15.4a2 2 0 001.7-3L13.7 4.2a2 2 0 00-3.4 0z" />,
  },
  info: {
    caixa: "bg-slate-50 border-slate-200 text-slate-700",
    icone: <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
  },
}

/** Faixa de aviso (erro, sucesso, atenção ou informação), com ação ou "Fechar" opcionais. */
export function Aviso({ tipo, children, acao, onFechar }: {
  tipo: TipoAviso
  children: ReactNode
  acao?: ReactNode
  onFechar?: () => void
}) {
  const estilo = ESTILO_AVISO[tipo]
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-lg border text-sm animar-esmaecer ${estilo.caixa}`}
      role={tipo === "erro" ? "alert" : "status"}
    >
      <svg className="w-5 h-5 flex-shrink-0 mt-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
        {estilo.icone}
      </svg>
      <div className="flex-1 min-w-0 leading-relaxed">{children}</div>
      {acao}
      {onFechar && (
        <button onClick={onFechar} className="flex-shrink-0 text-[13px] font-medium underline-offset-2 hover:underline">
          Fechar
        </button>
      )}
    </div>
  )
}

/** Faixa vermelha de erro com botão opcional de "Tentar novamente". */
export function AvisoErro({ mensagem, onTentarNovamente }: { mensagem: ReactNode; onTentarNovamente?: () => void }) {
  return (
    <Aviso
      tipo="erro"
      acao={onTentarNovamente && (
        <button
          onClick={onTentarNovamente}
          className="flex-shrink-0 h-7 px-2.5 rounded-md text-[13px] font-medium text-rose-800 bg-white border border-rose-200 hover:bg-rose-100 transition-colors"
        >
          Tentar novamente
        </button>
      )}
    >
      {mensagem}
    </Aviso>
  )
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
      <path className="opacity-90" stroke="currentColor" strokeWidth="3" strokeLinecap="round" d="M12 2a10 10 0 0110 10"></path>
    </svg>
  )
}

/** Estado vazio: o que aconteceu e o que fazer a seguir. */
export function Vazio({ titulo, descricao, acao }: { titulo: string; descricao?: ReactNode; acao?: ReactNode }) {
  return (
    <div className="px-6 py-14 flex flex-col items-center text-center">
      <svg className="w-9 h-9 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5l9-4.5 9 4.5M3 7.5v9l9 4.5m-9-13.5l9 4.5m0 9l9-4.5v-9m-9 13.5v-9m9-4.5l-9 4.5" />
      </svg>
      <p className="text-sm font-medium text-slate-800">{titulo}</p>
      {descricao && <p className="mt-1 text-[13px] text-slate-500 max-w-[52ch]">{descricao}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  )
}

/** Linhas cinzas no lugar de uma tabela enquanto ela carrega. */
export function EsqueletoTabela({ linhas = 6, rotulo = "Carregando" }: { linhas?: number; rotulo?: string }) {
  return (
    <div className="animate-pulse" role="status" aria-label={rotulo}>
      <div className="h-10 border-b border-slate-200 bg-slate-50/70" />
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="flex items-center gap-6 px-6 h-14 border-b border-slate-100 last:border-0">
          <div className="h-3 rounded bg-slate-200 w-1/4" />
          <div className="h-3 rounded bg-slate-100 w-1/6" />
          <div className="h-3 rounded bg-slate-100 w-1/6" />
          <div className="h-3 rounded bg-slate-100 flex-1" />
        </div>
      ))}
    </div>
  )
}

/** Rodapé de paginação: "1–50 de 1.234" + Anterior/Próxima. */
export function Paginacao({ inicio, fim, total, pagina, totalPaginas, onAnterior, onProxima }: {
  inicio: string
  fim: string
  total: string
  pagina: number
  totalPaginas: number
  onAnterior: () => void
  onProxima: () => void
}) {
  return (
    <div className="px-5 sm:px-6 py-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-[13px] text-slate-500">
      <span>
        <span className="font-medium text-slate-800">{inicio}–{fim}</span> de {total}
        <span className="hidden sm:inline"> · página {pagina + 1} de {totalPaginas}</span>
      </span>
      <div className="flex gap-2">
        <button onClick={onAnterior} disabled={pagina === 0} className={BOTAO_SECUNDARIO_P}>
          Anterior
        </button>
        <button onClick={onProxima} disabled={pagina + 1 >= totalPaginas} className={BOTAO_SECUNDARIO_P}>
          Próxima
        </button>
      </div>
    </div>
  )
}

/** Modal centralizado (confirmações). Fecha no Esc e no clique fora, exceto enquanto `ocupado`. */
export function Modal({ titulo, children, onFechar, ocupado = false, largo = false }: {
  titulo: string
  children: ReactNode
  onFechar: () => void
  ocupado?: boolean
  /** Formulários maiores (ex.: editor de regra). */
  largo?: boolean
}) {
  useFecharComEsc(onFechar, !ocupado)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50 animar-esmaecer" onClick={ocupado ? undefined : onFechar} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`relative w-full ${largo ? "max-w-4xl" : "max-w-md"} max-h-[92vh] overflow-y-auto bg-white rounded-2xl shadow-2xl shadow-slate-950/20 animar-surgir`}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 px-6 pt-5 pb-3 bg-white">
          <h2 className="text-base font-semibold text-slate-950 leading-snug">{titulo}</h2>
          <button
            onClick={onFechar}
            disabled={ocupado}
            aria-label="Fechar"
            className="-mr-2 -mt-1 w-8 h-8 flex-shrink-0 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-40"
          >
            <IconeFechar />
          </button>
        </div>
        <div className="px-6 pb-6 text-sm text-slate-600">{children}</div>
      </div>
    </div>
  )
}

/** Rodapé de ações de um modal (Cancelar à esquerda da ação principal). */
export function AcoesModal({ children }: { children: ReactNode }) {
  return <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">{children}</div>
}

/** Select nativo com a seta desenhada (mesma altura e borda dos inputs). */
export function Selecao({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={`relative ${className}`}>
      <select {...props} className={SELECT} />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-500">
        <IconeSeta />
      </span>
    </div>
  )
}

/** Rótulo + campo + erro (ou dica). */
export function CampoForm({ rotulo, erro, dica, grupo = false, children }: {
  rotulo: string
  erro?: string | null
  dica?: string
  /** true quando o conteúdo é um grupo de botões (não pode ficar dentro de <label>: o clique no rótulo acionaria o 1º botão). */
  grupo?: boolean
  children: ReactNode
}) {
  const Tag = grupo ? "div" : "label"
  return (
    <Tag className="block">
      <span className="block text-[13px] font-medium text-slate-700 mb-1.5">{rotulo}</span>
      {children}
      {erro ? (
        <span className="mt-1.5 flex items-center gap-1 text-xs font-medium text-rose-700">{erro}</span>
      ) : dica ? (
        <span className="block text-xs text-slate-500 mt-1.5">{dica}</span>
      ) : null}
    </Tag>
  )
}

const BOTAO =
  "inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
const BOTAO_P =
  "inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-medium whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-not-allowed"

export const BOTAO_PRIMARIO = `${BOTAO} bg-tinta text-white hover:bg-slate-800 active:bg-slate-950`
export const BOTAO_SECUNDARIO = `${BOTAO} bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 hover:border-slate-400`
export const BOTAO_PERIGO = `${BOTAO} bg-rose-700 text-white hover:bg-rose-800`
/** Ação destrutiva que abre uma confirmação (o vermelho cheio fica para o botão do modal). */
export const BOTAO_PERIGO_SECUNDARIO = `${BOTAO} bg-white text-rose-700 border border-rose-200 hover:bg-rose-50 hover:border-rose-300`
export const BOTAO_FANTASMA = `${BOTAO} text-slate-600 hover:text-slate-950 hover:bg-slate-100`
/** Versões compactas, para ações dentro de painéis e tabelas. */
export const BOTAO_SECUNDARIO_P = `${BOTAO_P} bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:text-slate-950`
export const BOTAO_FANTASMA_P = `${BOTAO_P} text-slate-600 hover:text-slate-950 hover:bg-slate-100`
export const BOTAO_PERIGO_FANTASMA_P = `${BOTAO_P} text-rose-700 hover:text-rose-800 hover:bg-rose-50`

export function IconeDownload() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  )
}

export function IconeFechar() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

export function IconeSeta() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}
