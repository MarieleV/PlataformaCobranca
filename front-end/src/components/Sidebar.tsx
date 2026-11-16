import { useState, type ReactNode } from "react"
import logoTcc from "../assets/logo-tcc.png"
import { useAuth } from "../auth/AuthContext"
import { NOME_PERFIL, PERFIS_POR_PAGINA, type Page } from "../auth/permissoes"
import { useFecharComEsc } from "../hooks/useFecharComEsc"
import MinhaConta from "./MinhaConta"

interface SidebarProps {
  current: Page
  onNavigate: (p: Page) => void
  /** Telas estreitas: a barra vira gaveta e só aparece quando aberta. */
  aberta: boolean
  onFechar: () => void
}

// "Mariele Vieira" -> "MV"; "Admin" -> "AD"
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return "?"
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

const icone = (d: string) => (
  <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
)

// Agrupados pelo que a pessoa faz: acompanhar, alimentar a cobrança, administrar.
const grupos: { titulo: string; itens: { id: Page; label: string; icon: ReactNode }[] }[] = [
  {
    titulo: "Acompanhar",
    itens: [
      { id: "dashboard", label: "Dashboard", icon: icone("M4 5h6v6H4zM14 5h6v4h-6zM14 13h6v6h-6zM4 15h6v4H4z") },
      { id: "devedores", label: "Devedores", icon: icone("M17 20h5v-2a3 3 0 00-5.36-1.86M17 20H7m10 0v-2c0-.66-.13-1.28-.36-1.86M7 20H2v-2a3 3 0 015.36-1.86M7 20v-2c0-.66.13-1.28.36-1.86m0 0a5 5 0 019.28 0M15 7a3 3 0 11-6 0 3 3 0 016 0z") },
      { id: "monitoramento", label: "Monitoramento", icon: icone("M3 12h4l3-8 4 16 3-8h4") },
    ],
  },
  {
    titulo: "Cobrança",
    itens: [
      { id: "importar", label: "Importar lote", icon: icone("M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12") },
      { id: "validacao", label: "Relatório de validação", icon: icone("M9 12l2 2 4-4M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z") },
      { id: "regua", label: "Régua de cobrança", icon: icone("M3 8h18v8H3zM7 8v3M11 8v4M15 8v3M19 8v4") },
    ],
  },
  {
    titulo: "Administração",
    itens: [
      { id: "usuarios", label: "Usuários", icon: icone("M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z") },
      { id: "auditoria", label: "Auditoria", icon: icone("M9 12l2 2 4-4m5.62-4.02A11.96 11.96 0 0112 2.94a11.96 11.96 0 01-8.62 3.04A12 12 0 003 9c0 5.59 3.82 10.29 9 11.62 5.18-1.33 9-6.03 9-11.62 0-1.04-.13-2.05-.38-3.02z") },
    ],
  },
]

export default function Sidebar({ current, onNavigate, aberta, onFechar }: SidebarProps) {
  const { usuario, logout, pode } = useAuth()
  const [saindo, setSaindo] = useState(false)
  const [minhaConta, setMinhaConta] = useState(false)
  useFecharComEsc(onFechar, aberta)

  const handleLogout = async () => {
    setSaindo(true)
    await logout() // desmonta a área logada; não precisa voltar o estado
  }

  const navegar = (p: Page) => {
    onNavigate(p)
    onFechar()
  }

  return (
    <>
      {aberta && <div className="fixed inset-0 z-30 bg-slate-950/40 md:hidden animar-esmaecer" onClick={onFechar} />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 md:static md:z-auto md:w-60 xl:w-64 bg-white border-r border-slate-200 flex flex-col h-full flex-shrink-0 select-none transition-transform md:translate-x-0 ${
          aberta ? "translate-x-0 shadow-2xl md:shadow-none" : "-translate-x-full max-md:invisible"
        }`}
        aria-label="Menu principal"
      >
        {/* --- LOGO --- */}
        <div className="h-14 px-5 border-b border-slate-200 flex items-center gap-3">
          <img src={logoTcc} alt="" className="w-8 h-8 object-contain flex-shrink-0 rounded-md" />
          <div className="leading-tight">
            <p className="font-semibold text-slate-950 text-sm">Cobrança Automatizada</p>
            <p className="text-xs text-slate-500">Consulth</p>
          </div>
        </div>

        {/* --- NAVEGAÇÃO --- */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {grupos.map((grupo) => {
            const itens = grupo.itens.filter((item) => pode(PERFIS_POR_PAGINA[item.id]))
            if (itens.length === 0) return null
            return (
              <div key={grupo.titulo}>
                <p className="px-3 mb-1.5 text-xs font-medium text-slate-400">{grupo.titulo}</p>
                <ul className="space-y-0.5">
                  {itens.map((item) => {
                    const ativo = current === item.id
                    return (
                      <li key={item.id}>
                        <button
                          onClick={() => navegar(item.id)}
                          aria-current={ativo ? "page" : undefined}
                          className={`relative w-full flex items-center gap-3 h-9 px-3 rounded-md text-sm transition-colors ${
                            ativo
                              ? "bg-slate-100 text-slate-950 font-medium"
                              : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                          }`}
                        >
                          {ativo && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-tinta" aria-hidden="true" />}
                          <span className={ativo ? "text-slate-950" : "text-slate-400"}>{item.icon}</span>
                          <span className="truncate">{item.label}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </nav>

        {/* --- USUÁRIO --- */}
        <div className="p-3 border-t border-slate-200 space-y-1">
          <button
            onClick={() => setMinhaConta(true)}
            title="Minha conta: dados e troca de senha"
            className="w-full text-left flex items-center gap-3 px-2 py-2 rounded-md hover:bg-slate-50 transition-colors"
          >
            <span className="w-8 h-8 rounded-full bg-tinta text-white font-medium text-xs flex items-center justify-center flex-shrink-0">
              {iniciais(usuario?.nome ?? "")}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-950 truncate">{usuario?.nome}</span>
              <span className="block text-xs text-slate-500 truncate">
                {usuario ? NOME_PERFIL[usuario.perfil] : ""} · Minha conta
              </span>
            </span>
          </button>
          {minhaConta && <MinhaConta onFechar={() => setMinhaConta(false)} />}

          <button
            onClick={handleLogout}
            disabled={saindo}
            className="w-full flex items-center gap-3 h-9 px-3 rounded-md text-sm text-slate-600 hover:text-rose-800 hover:bg-rose-50 transition-colors disabled:opacity-60 disabled:cursor-wait"
          >
            {icone("M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1")}
            {saindo ? "Encerrando..." : "Encerrar sessão"}
          </button>
        </div>
      </aside>
    </>
  )
}
