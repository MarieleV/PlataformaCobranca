import { useState } from "react"

interface LoginProps {
  onLogin: () => void
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!email || !password) {
      setError("Preencha todos os campos.")
      return
    }
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      onLogin()
    }, 1200)
  }

  return (
    <div
      className="min-h-screen flex"
      style={{ background: "var(--background)" }}
    >
      {/* Left panel */}
      <div
        className="hidden lg:flex flex-col justify-between p-12"
        style={{
          width: 480,
          flexShrink: 0,
          background: "var(--sidebar)",
          borderRight: "1px solid var(--border)",
        }}
      >
        <div>
          <div className="flex items-center gap-3 mb-16">
            <div
              style={{ background: "var(--primary)", borderRadius: 6, width: 36, height: 36 }}
              className="flex items-center justify-center"
            >
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14, color: "#fff" }}>CA</span>
            </div>
            <div>
              <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "var(--foreground)" }}>
                Cobrança Automatizada
              </p>
              <p style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Consulth Soluções Empresariais</p>
            </div>
          </div>

          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 36,
              color: "var(--foreground)",
              lineHeight: 1.15,
              marginBottom: 16,
            }}
          >
            Gestão de cobrança escalável e auditável.
          </h1>
          <p style={{ fontSize: 14, color: "var(--muted-foreground)", lineHeight: 1.7 }}>
            Automatize o ciclo completo de inadimplência — da ingestão de dados ao disparo multicanal — com rastreabilidade total e zero intervenção manual.
          </p>
        </div>

        <div className="space-y-4">
          {[
            { metric: "70M+", label: "Inadimplentes no Brasil (Serasa)" },
            { metric: "10k", label: "Registros por minuto processados" },
            { metric: "95%+", label: "Taxa de entrega de e-mails" },
          ].map((s) => (
            <div
              key={s.metric}
              className="flex items-center gap-4 px-4 py-3 rounded"
              style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.12)" }}
            >
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: 22,
                  color: "var(--primary)",
                  minWidth: 60,
                }}
              >
                {s.metric}
              </span>
              <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div style={{ width: "100%", maxWidth: 400 }}>
          <div className="mb-8">
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 26,
                color: "var(--foreground)",
                marginBottom: 6,
              }}
            >
              Acessar plataforma
            </h2>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
              Insira suas credenciais para continuar.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                style={{ fontSize: 12, color: "var(--muted-foreground)", fontWeight: 500, display: "block", marginBottom: 6 }}
              >
                E-mail corporativo
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="analista@empresa.com.br"
                className="w-full px-3 py-2.5 rounded outline-none transition-all"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border-strong)",
                  color: "var(--foreground)",
                  fontSize: 14,
                  fontFamily: "var(--font-sans)",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--primary)" }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-strong)" }}
              />
            </div>
            <div>
              <label
                htmlFor="password"
                style={{ fontSize: 12, color: "var(--muted-foreground)", fontWeight: 500, display: "block", marginBottom: 6 }}
              >
                Senha
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 rounded outline-none transition-all"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border-strong)",
                  color: "var(--foreground)",
                  fontSize: 14,
                  fontFamily: "var(--font-sans)",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--primary)" }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-strong)" }}
              />
            </div>

            {error && (
              <p style={{ fontSize: 12, color: "var(--danger)" }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded font-medium transition-all"
              style={{
                background: loading ? "rgba(59,130,246,0.5)" : "var(--primary)",
                color: "#fff",
                fontSize: 14,
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                border: "none",
              }}
            >
              {loading ? "Autenticando…" : "Entrar"}
            </button>
          </form>

          <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 24, textAlign: "center" }}>
            Autenticação via JWT · Sessão de 15 min
          </p>
        </div>
      </div>
    </div>
  )
}
