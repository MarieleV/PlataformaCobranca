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

const navItems: { id: Page; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "◈" },
  { id: "importar", label: "Importar Lote", icon: "↑" },
  { id: "validacao", label: "Relatório de Validação", icon: "✓" },
  { id: "regua", label: "Régua de Cobrança", icon: "⊞" },
  { id: "devedores", label: "Devedores", icon: "≡" },
  { id: "monitoramento", label: "Monitoramento", icon: "▶" },
  { id: "usuarios", label: "Usuários", icon: "⊙" },
]

export default function Sidebar({ current, onNavigate, onLogout }: SidebarProps) {
  return (
    <aside
      style={{ background: "var(--sidebar)", borderRight: "1px solid var(--border)", width: 236, flexShrink: 0 }}
      className="flex flex-col h-full"
    >
      {/* Logo */}
      <div style={{ borderBottom: "1px solid var(--border)" }} className="px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div
            style={{ background: "var(--primary)", borderRadius: 5 }}
            className="w-7 h-7 flex items-center justify-center"
          >
            <span style={{ color: "#fff", fontSize: 13, fontFamily: "var(--font-mono)", fontWeight: 700 }}>
              CA
            </span>
          </div>
          <div>
            <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, color: "var(--foreground)", lineHeight: 1.2 }}>
              Cobrança
            </p>
            <p style={{ fontSize: 10, color: "var(--muted-foreground)", letterSpacing: "0.05em" }}>
              Automatizada
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        <div className="px-3 mb-1">
          <p style={{ fontSize: 10, color: "var(--muted-foreground)", letterSpacing: "0.08em", fontFamily: "var(--font-mono)" }}
            className="px-2 mb-2 uppercase">
            Navegação
          </p>
          {navItems.map((item) => {
            const active = current === item.id
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded mb-0.5 transition-all text-left"
                style={{
                  background: active ? "rgba(59,130,246,0.12)" : "transparent",
                  color: active ? "var(--primary)" : "var(--secondary-foreground)",
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  borderLeft: active ? "2px solid var(--primary)" : "2px solid transparent",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"
                    ;(e.currentTarget as HTMLElement).style.color = "var(--foreground)"
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = "transparent"
                    ;(e.currentTarget as HTMLElement).style.color = "var(--secondary-foreground)"
                  }
                }}
              >
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, width: 16, textAlign: "center" }}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* User footer */}
      <div style={{ borderTop: "1px solid var(--border)" }} className="px-4 py-4">
        <div className="flex items-center gap-3 mb-3">
          <div
            style={{ background: "rgba(59,130,246,0.2)", borderRadius: "50%", width: 32, height: 32, flexShrink: 0 }}
            className="flex items-center justify-center"
          >
            <span style={{ fontSize: 12, color: "var(--primary)", fontWeight: 700 }}>MV</span>
          </div>
          <div className="overflow-hidden">
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              Mariele Vieira
            </p>
            <p style={{ fontSize: 10, color: "var(--muted-foreground)" }}>Gestor Financeiro</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full text-left px-3 py-2 rounded transition-all"
          style={{ fontSize: 12, color: "var(--muted-foreground)", background: "transparent" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.08)"
            ;(e.currentTarget as HTMLElement).style.color = "var(--danger)"
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent"
            ;(e.currentTarget as HTMLElement).style.color = "var(--muted-foreground)"
          }}
        >
          ← Sair da conta
        </button>
      </div>
    </aside>
  )
}

export type { Page }
