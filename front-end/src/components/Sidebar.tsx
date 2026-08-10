import type { ReactNode } from 'react'
import logoTcc from "../assets/logo-tcc.png"

type Page =
  | "dashboard"
  | "importar"
  | "validacao"
  | "regua"
  | "devedores"
  | "monitoramento"
  | "usuarios"

interface SidebarProps {
  current: Page
  onNavigate: (p: Page) => void
  onLogout: () => void
}

const navItems: { id: Page; label: string; icon: (isActive: boolean) => ReactNode }[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: (active) => (
      <svg className={`w-4 h-4 ${active ? "text-black" : "text-slate-400 group-hover:text-slate-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    id: "importar",
    label: "Importar Lote",
    icon: (active) => (
      <svg className={`w-4 h-4 ${active ? "text-black" : "text-slate-400 group-hover:text-slate-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
  },
  {
    id: "validacao",
    label: "Relatório de Validação",
    icon: (active) => (
      <svg className={`w-4 h-4 ${active ? "text-black" : "text-slate-400 group-hover:text-slate-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: "regua",
    label: "Régua de Cobrança",
    icon: (active) => (
      <svg className={`w-4 h-4 ${active ? "text-black" : "text-slate-400 group-hover:text-slate-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    id: "devedores",
    label: "Devedores",
    icon: (active) => (
      <svg className={`w-4 h-4 ${active ? "text-black" : "text-slate-400 group-hover:text-slate-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    id: "monitoramento",
    label: "Monitoramento",
    icon: (active) => (
      <svg className={`w-4 h-4 ${active ? "text-black" : "text-slate-400 group-hover:text-slate-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: "usuarios",
    label: "Usuários",
    icon: (active) => (
      <svg className={`w-4 h-4 ${active ? "text-black" : "text-slate-400 group-hover:text-slate-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
]

export default function Sidebar({ current, onNavigate, onLogout }: SidebarProps) {
  return (
    <aside className="w-64 bg-white border-r border-slate-200/60 flex flex-col h-full flex-shrink-0 font-sans select-none">
      
      {/* --- LOGO --- */}
      <div className="px-6 py-6 border-b border-slate-100 flex items-center gap-3">
        <img 
          src={logoTcc}
          alt="Logo Cobrança Automatizada" 
          className="w-10 h-10 object-contain flex-shrink-0 rounded-md" 
        />
        <div>
          <p className="font-bold text-slate-900 text-sm tracking-tight leading-none mb-1">
            Cobrança
          </p>
          <p className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
            Automatizada
          </p>
        </div>
      </div>

      {/* --- NAVIGATION --- */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto space-y-1">
        <p className="px-3 mb-2 text-[10px] font-bold text-slate-400 tracking-widest uppercase">
          Menu Principal
        </p>
        
        {navItems.map((item) => {
          const active = current === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                active
                  ? "bg-slate-100 text-black shadow-sm shadow-black/5"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {item.icon(active)}
              <span className="truncate">{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* --- USER FOOTER --- */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-slate-200 text-black font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-sm">
            MV
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-bold text-slate-900 truncate">
              Mariele Vieira
            </p>
            <p className="text-[11px] text-slate-500 font-medium truncate">Gestor Financeiro</p>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sair da conta
        </button>
      </div>
    </aside>
  )
}

export type { Page }