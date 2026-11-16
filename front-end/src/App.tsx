import { useCallback, useState } from "react"
import Sidebar from "./components/Sidebar"
import { Spinner } from "./components/ui"
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
import Auditoria from "./pages/Auditoria"

const pageTitles: Record<Page, string> = {
  dashboard: "Dashboard",
  importar: "Importar lote",
  validacao: "Relatório de validação",
  regua: "Régua de cobrança",
  devedores: "Devedores",
  monitoramento: "Monitoramento",
  usuarios: "Usuários",
  auditoria: "Auditoria",
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
  // Job aberto no painel do Monitoramento (null = nenhum)
  const [jobAberto, setJobAberto] = useState<string | null>(null)
  // Menu lateral como gaveta em telas estreitas
  const [menuAberto, setMenuAberto] = useState(false)
  const fecharMenu = useCallback(() => setMenuAberto(false), [])

  const abrirJob = (jobId: string) => {
    setJobAberto(jobId)
    setPage("monitoramento")
  }

  return (
    <div className="flex h-screen overflow-hidden bg-papel">
      <Sidebar current={page} onNavigate={setPage} aberta={menuAberto} onFechar={fecharMenu} />

      <main className="flex-1 min-w-0 overflow-hidden flex flex-col">

        {/* --- BARRA SUPERIOR --- */}
        <div className="h-14 px-4 md:px-6 xl:px-8 border-b border-slate-200 bg-white flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0 text-sm">
            <button
              onClick={() => setMenuAberto(true)}
              aria-label="Abrir menu"
              className="md:hidden -ml-1.5 w-9 h-9 inline-flex items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <span className="hidden sm:inline text-slate-500">Plataforma</span>
            <span className="hidden sm:inline text-slate-300" aria-hidden="true">/</span>
            <span className="font-medium text-slate-950 truncate">{pageTitles[page]}</span>
          </div>
          <span className="hidden sm:inline text-xs text-slate-400 whitespace-nowrap">Consulth Soluções</span>
        </div>

        {/* --- CONTEÚDO --- */}
        <div className="flex-1 overflow-hidden">
          {page === "dashboard" && <Dashboard onNavigate={setPage} onAbrirLote={abrirRelatorio} onAbrirJob={abrirJob} />}
          {page === "importar" && <ImportarLote onVerRelatorio={abrirRelatorio} />}
          {page === "validacao" && (
            <RelatorioValidacao
              loteId={loteRelatorio}
              onSelecionarLote={setLoteRelatorio}
              onImportar={() => setPage("importar")}
            />
          )}
          {page === "regua" && <ReguaCobranca />}
          {page === "devedores" && <Devedores onAbrirLote={abrirRelatorio} />}
          {page === "monitoramento" && <Monitoramento jobId={jobAberto} onAbrirJob={setJobAberto} />}
          {page === "usuarios" && <Usuarios />}
          {page === "auditoria" && <Auditoria />}
        </div>
      </main>
    </div>
  )
}

function TelaCarregando() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-papel">
      <div className="flex items-center gap-3 text-sm text-slate-500" role="status">
        <Spinner className="h-5 w-5 text-slate-900" />
        Verificando sessão...
      </div>
    </div>
  )
}
