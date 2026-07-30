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
    <div
      style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--background)" }}
    >
      <Sidebar current={page} onNavigate={setPage} onLogout={() => setLoggedIn(false)} />

      <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* Top bar */}
        <div
          style={{
            height: 52,
            display: "flex",
            alignItems: "center",
            paddingLeft: 28,
            paddingRight: 28,
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
            justifyContent: "space-between",
          }}
        >
          <div className="flex items-center gap-2" style={{ color: "var(--muted-foreground)", fontSize: 13 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>Plataforma de Cobrança</span>
            <span style={{ color: "var(--border-strong)" }}>/</span>
            <span style={{ color: "var(--foreground)", fontWeight: 500 }}>{pageTitles[page]}</span>
          </div>
          <div className="flex items-center gap-4">
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted-foreground)" }}>
              v1.0.0-beta
            </span>
            <div
              className="flex items-center gap-2"
              style={{
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                color: "var(--muted-foreground)",
                background: "var(--card)",
                border: "1px solid var(--border)",
                padding: "4px 10px",
                borderRadius: 4,
              }}
            >
              <span style={{ color: "var(--accent)", fontSize: 8 }}>●</span>
              API online
            </div>
          </div>
        </div>

        {/* Page content */}
        <div style={{ flex: 1, overflow: "hidden" }}>
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
