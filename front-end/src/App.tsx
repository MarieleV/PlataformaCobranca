import { useState } from "react"
import Sidebar from "./components/Sidebar"
import { useAuth } from "./auth/AuthContext"
import { PERFIS_POR_PAGINA, type Page } from "./auth/permissoes"
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
  const { usuario, carregando } = useAuth()

  if (carregando) return <TelaCarregando />
  if (!usuario) return <Login />

  // Componente separado: ao sair, ele desmonta e a página volta ao Dashboard
  // no próximo login (que pode ser de outro usuário, com outro perfil).
  return <AreaLogada />
}

function AreaLogada() {
  const { pode } = useAuth()
  const [pageEscolhida, setPage] = useState<Page>("dashboard")
  const page = pode(PERFIS_POR_PAGINA[pageEscolhida]) ? pageEscolhida : "dashboard"
  // Lote aberto no Relatório de Validação (null = o mais recente)
  const [loteRelatorio, setLoteRelatorio] = useState<string | null>(null)

  const abrirRelatorio = (loteId: string) => {
    setLoteRelatorio(loteId)
    setPage("validacao")
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans select-none">
      <Sidebar current={page} onNavigate={setPage} />

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
          {page === "dashboard" && <Dashboard onNavigate={setPage} onAbrirLote={abrirRelatorio} />}
          {page === "importar" && <ImportarLote onVerRelatorio={abrirRelatorio} />}
          {page === "validacao" && (
            <RelatorioValidacao
              loteId={loteRelatorio}
              onSelecionarLote={setLoteRelatorio}
              onImportar={() => setPage("importar")}
            />
          )}
          {page === "regua" && <ReguaCobranca />}
          {page === "devedores" && <Devedores />}
          {page === "monitoramento" && <Monitoramento />}
          {page === "usuarios" && <Usuarios />}
        </div>
      </main>
    </div>
  )
}

function TelaCarregando() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans">
      <div className="flex items-center gap-3 text-sm font-semibold text-slate-500">
        <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Verificando sessão...
      </div>
    </div>
  )
}
