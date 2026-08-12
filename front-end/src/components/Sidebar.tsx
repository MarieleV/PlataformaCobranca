import type { ReactNode } from "react"
import logoTcc from "../assets/logo-tcc.png"

export type Page =
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
      <svg className={`w-[16px] h-[16px] lg:w-[18px] lg:h-[18px] transition-colors ${active ? "text-black" : "text-slate-400 group-hover:text-slate-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
    ),
  },
  {
    id: "importar",
    label: "Importar Lote",
    icon: (active) => (
      <svg className={`w-[16px] h-[16px] lg:w-[18px] lg:h-[18px] transition-colors ${active ? "text-black" : "text-slate-400 group-hover:text-slate-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
    ),
  },
  {
    id: "validacao",
    label: "Relatório",
    icon: (active) => (
      <svg className={`w-[16px] h-[16px] lg:w-[18px] lg:h-[18px] transition-colors ${active ? "text-black" : "text-slate-400 group-hover:text-slate-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    ),
  },
  {
    id: "regua",
    label: "Régua de Cobrança",
    icon: (active) => (
      <svg className={`w-[16px] h-[16px] lg:w-[18px] lg:h-[18px] transition-colors ${active ? "text-black" : "text-slate-400 group-hover:text-slate-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
    ),
  },
  {
    id: "devedores",
    label: "Devedores",
    icon: (active) => (
      <svg className={`w-[16px] h-[16px] lg:w-[18px] lg:h-[18px] transition-colors ${active ? "text-black" : "text-slate-400 group-hover:text-slate-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
    ),
  },
  {
    id: "monitoramento",
    label: "Monitoramento",
    icon: (active) => (
      <svg className={`w-[16px] h-[16px] lg:w-[18px] lg:h-[18px] transition-colors ${active ? "text-black" : "text-slate-400 group-hover:text-slate-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
    ),
  },
  {
    id: "usuarios",
    label: "Usuários",
    icon: (active) => (
      <svg className={`w-[16px] h-[16px] lg:w-[18px] lg:h-[18px] transition-colors ${active ? "text-black" : "text-slate-400 group-hover:text-slate-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
    ),
  },
]

export default function Sidebar({ current, onNavigate, onLogout }: SidebarProps) {
  return (
    // Largura dinâmica: 208px em telas menores, 256px no desktop médio, 288px (original) no monitor grande
    <aside className="w-52 lg:w-64 xl:w-72 bg-white border-r border-slate-200/80 flex flex-col h-full flex-shrink-0 font-sans select-none z-20 relative">
      
      {/* --- LOGO --- */}
      {/* Reduzimos o padding e o tamanho da imagem dinamicamente */}
      <div className="px-4 lg:px-7 py-5 lg:py-8 border-b border-slate-100 flex items-center gap-3 lg:gap-4">
        <img 
          src={logoTcc}
          alt="Logo Cobrança Automatizada" 
          className="w-8 h-8 lg:w-11 lg:h-11 object-contain flex-shrink-0 rounded-md" 
        />
        <div>
          <p className="font-bold text-slate-900 text-[13px] lg:text-[15px] tracking-tight leading-none mb-1">
            Cobrança
          </p>
          <p className="text-[9px] lg:text-[11px] font-bold text-slate-400 tracking-widest uppercase">
            Automatizada
          </p>
        </div>
      </div>

      {/* --- NAVIGATION --- */}
      {/* Reduzimos o padding lateral dos botões */}
      <nav className="flex-1 py-4 lg:py-6 px-2 lg:px-4 overflow-y-auto space-y-1 custom-scrollbar">
        <p className="px-3.5 mb-2 lg:mb-3 text-[9px] lg:text-[10px] font-bold text-slate-400 tracking-widest uppercase">
          Menu Principal
        </p>
        
        {navItems.map((item) => {
          const active = current === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-2.5 lg:gap-3 px-3 lg:px-3.5 py-2 lg:py-2.5 rounded-xl text-xs lg:text-[13px] font-semibold transition-all group ${
                active
                  ? "bg-slate-100 text-black shadow-sm shadow-black/5"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {item.icon(active)}
              <span className="truncate">{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* --- USER FOOTER --- */}
      {/* Ajustamos o container do perfil e o botão de logout */}
      <div className="p-3 lg:p-5 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2.5 lg:gap-3.5 mb-3 lg:mb-4 px-1 lg:px-2">
          <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-slate-200 text-black font-bold text-xs lg:text-sm flex items-center justify-center flex-shrink-0 shadow-sm">
            MV
          </div>
          <div className="overflow-hidden">
            <p className="text-xs lg:text-sm font-bold text-slate-900 truncate">
              Mariele Vieira
            </p>
            <p className="text-[9px] lg:text-[11px] font-medium text-slate-500 tracking-wide uppercase truncate">
              Gestor Financeiro
            </p>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 lg:gap-2.5 px-3 lg:px-3.5 py-2 lg:py-2.5 rounded-xl text-xs lg:text-[13px] font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all"
        >
          <svg className="w-[16px] h-[16px] lg:w-[18px] lg:h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Encerrar sessão
        </button>
      </div>
    </aside>
  )
}