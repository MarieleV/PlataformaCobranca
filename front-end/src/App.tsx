import { useState } from "react"
import Sidebar, { type Page } from "./components/Sidebar"
import Login from "./pages/Login"
import Dashboard from "./pages/Dashboard"
import ImportarLote from "./pages/ImportarLote"
import RelatorioValidacao from "./pages/RelatorioValidacao"
import ReguaCobranca from "./pages/ReguaCobranca"
import Devedores from "./pages/Devedores"
import Monitoramento from "./pages/Monitoramento"
import Usuarios from "./pages/Usuarios"

const pageTitles: Record<Page, string> = {
  dashboard: "Dashboard",
  importar: "Importar Lote",
  validacao: "Relatório de Validação",
  regua: "Régua de Cobrança",
  devedores: "Devedores",
  monitoramento: "Monitoramento",
  usuarios: "Usuários",
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [page, setPage] = useState<Page>("dashboard")

  if (!loggedIn) {
    return <Login onLogin={() => setLoggedIn(true)} />
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans select-none">
      <Sidebar current={page} onNavigate={setPage} onLogout={() => setLoggedIn(false)} />

      <main className="flex-1 overflow-hidden flex flex-col bg-slate-50">
        
        {/* --- TOP BAR --- */}
        <div className="h-16 px-8 border-b border-slate-200/80 bg-white flex items-center justify-between flex-shrink-0 z-10">
          
          {/* Navegação Estrutural (Breadcrumbs) */}
          <div className="flex items-center gap-2.5 text-sm">
            <span className="font-medium text-slate-500">
              Plataforma
            </span>
            <svg className="w-3.5 h-3.5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-black font-bold tracking-tight">
              {pageTitles[page]}
            </span>
          </div>

          {/* Metadados / Perfil */}
          <div className="flex items-center gap-4">
            <span className="font-mono text-[10px] font-bold text-slate-400 tracking-widest uppercase">
              Consulth Soluções
            </span>
          </div>
        </div>

        {/* --- PAGE CONTENT --- */}
        <div className="flex-1 overflow-hidden bg-slate-50">
          {page === "dashboard" && <Dashboard />}
          {page === "importar" && (
            <ImportarLote onValidated={() => setPage("validacao")} />
          )}
          {page === "validacao" && <RelatorioValidacao />}
          {page === "regua" && <ReguaCobranca />}
          {page === "devedores" && <Devedores />}
          {page === "monitoramento" && <Monitoramento />}
          {page === "usuarios" && <Usuarios />}
        </div>
      </main>
    </div>
  )
}