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
        <div className="h-14 px-7 border-b border-slate-200/60 bg-white flex items-center justify-between flex-shrink-0 shadow-sm/5">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-mono text-xs text-slate-400">Plataforma de Cobrança</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-semibold">{pageTitles[page]}</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="font-mono text-xs text-slate-400">
              v1.0.0-beta
            </span>
            
            <div className="flex items-center gap-2 text-xs font-mono bg-emerald-50/50 border border-emerald-200/60 px-3 py-1 rounded-md shadow-sm">
              <span className="text-emerald-500 text-[10px] animate-pulse">●</span>
              <span className="font-semibold text-emerald-700">API online</span>
            </div>
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