import { useState } from "react"

const usuarios = [
  { id: "U-001", nome: "Mariele Vieira da Silva", email: "mariele.vieira@consulth.com.br", perfil: "admin", status: "ativo", ultimo_acesso: "30/07 08:01" },
  { id: "U-002", nome: "Fellipe Junkes", email: "fellipe.junkes@consulth.com.br", perfil: "gestor", status: "ativo", ultimo_acesso: "29/07 17:42" },
  { id: "U-003", nome: "Heloizi Vargas", email: "heloizi.vargas@coop-sc.com.br", perfil: "operador", status: "ativo", ultimo_acesso: "30/07 07:55" },
  { id: "U-004", nome: "Rodrigo Becker", email: "r.becker@coop-sc.com.br", perfil: "operador", status: "ativo", ultimo_acesso: "28/07 13:10" },
  { id: "U-005", nome: "Aline Moraes", email: "aline.moraes@consulth.com.br", perfil: "gestor", status: "inativo", ultimo_acesso: "15/07 09:30" },
]

const perfilColor: Record<string, string> = {
  admin: "#EF4444",
  gestor: "#A78BFA",
  operador: "#3B82F6",
}

const perfilLabel: Record<string, string> = {
  admin: "Administrador",
  gestor: "Gestor",
  operador: "Operador",
}

export default function Usuarios() {
  const [showModal, setShowModal] = useState(false)

  return (
    <div className="p-7 overflow-y-auto h-full">
      <div className="mb-7 flex items-start justify-between">
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, color: "var(--foreground)" }}>
            Gestão de Usuários
          </h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>
            Apenas administradores podem gerenciar usuários e permissões (RN06).
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 rounded"
          style={{ background: "var(--primary)", color: "#fff", fontSize: 13, fontFamily: "var(--font-display)", fontWeight: 600 }}
        >
          + Convidar Usuário
        </button>
      </div>

      {/* Perfil legend */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { perfil: "admin", desc: "Acesso total: usuários, régua, importação, monitoramento" },
          { perfil: "gestor", desc: "Dashboard, régua, devedores, monitoramento" },
          { perfil: "operador", desc: "Importação de lotes, lista de devedores" },
        ].map((p) => (
          <div
            key={p.perfil}
            className="p-4 rounded"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  fontWeight: 700,
                  color: perfilColor[p.perfil],
                  background: `${perfilColor[p.perfil]}15`,
                  padding: "2px 7px",
                  borderRadius: 3,
                }}
              >
                {p.perfil.toUpperCase()}
              </span>
            </div>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>{p.desc}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["ID", "Nome", "E-mail", "Perfil", "Status", "Último acesso", "Ações"].map((h) => (
                <th
                  key={h}
                  className="px-5 py-3 text-left"
                  style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u, i) => (
              <tr
                key={u.id}
                style={{ borderBottom: i < usuarios.length - 1 ? "1px solid var(--border)" : "none" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)" }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent" }}
              >
                <td className="px-5 py-3.5">
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted-foreground)" }}>{u.id}</span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: `${perfilColor[u.perfil]}20`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        color: perfilColor[u.perfil],
                        flexShrink: 0,
                      }}
                    >
                      {u.nome.split(" ").slice(0, 2).map((n) => n[0]).join("")}
                    </div>
                    <span style={{ fontSize: 13, color: "var(--foreground)", fontWeight: 500 }}>{u.nome}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted-foreground)" }}>{u.email}</span>
                </td>
                <td className="px-5 py-3.5">
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                      fontWeight: 700,
                      color: perfilColor[u.perfil],
                      background: `${perfilColor[u.perfil]}15`,
                      padding: "2px 7px",
                      borderRadius: 3,
                    }}
                  >
                    {perfilLabel[u.perfil]}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: u.status === "ativo" ? "var(--accent)" : "var(--muted-foreground)",
                        display: "inline-block",
                      }}
                    />
                    <span style={{ fontSize: 12, color: u.status === "ativo" ? "var(--accent)" : "var(--muted-foreground)", textTransform: "capitalize" }}>
                      {u.status}
                    </span>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted-foreground)" }}>{u.ultimo_acesso}</span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex gap-2">
                    <button
                      className="px-3 py-1 rounded text-xs transition-all"
                      style={{ background: "var(--secondary)", color: "var(--foreground)", fontSize: 11 }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)" }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--secondary)" }}
                    >
                      Editar
                    </button>
                    {u.status === "ativo" && (
                      <button
                        className="px-3 py-1 rounded text-xs transition-all"
                        style={{ background: "rgba(239,68,68,0.08)", color: "var(--danger)", fontSize: 11, border: "1px solid rgba(239,68,68,0.15)" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.15)" }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.08)" }}
                      >
                        Desativar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite modal */}
      {showModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="rounded p-7"
            style={{ background: "var(--card)", border: "1px solid var(--border-strong)", width: 440 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "var(--foreground)", marginBottom: 6 }}>
              Convidar novo usuário
            </h3>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 20 }}>
              Um e-mail de convite com link de acesso será enviado.
            </p>
            <div className="space-y-4">
              {[
                { label: "Nome completo", placeholder: "ex: João da Silva" },
                { label: "E-mail corporativo", placeholder: "joao@empresa.com.br" },
              ].map((f) => (
                <div key={f.label}>
                  <label style={{ fontSize: 12, color: "var(--muted-foreground)", display: "block", marginBottom: 6 }}>{f.label}</label>
                  <input
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2.5 rounded outline-none"
                    style={{ background: "var(--secondary)", border: "1px solid var(--border-strong)", color: "var(--foreground)", fontSize: 13 }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "var(--primary)" }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-strong)" }}
                  />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 12, color: "var(--muted-foreground)", display: "block", marginBottom: 6 }}>Perfil de acesso</label>
                <select
                  className="w-full px-3 py-2.5 rounded outline-none"
                  style={{ background: "var(--secondary)", border: "1px solid var(--border-strong)", color: "var(--foreground)", fontSize: 13 }}
                >
                  <option value="operador">Operador</option>
                  <option value="gestor">Gestor</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                className="flex-1 py-2.5 rounded"
                style={{ background: "var(--primary)", color: "#fff", fontSize: 13, fontFamily: "var(--font-display)", fontWeight: 600 }}
                onClick={() => setShowModal(false)}
              >
                Enviar convite
              </button>
              <button
                className="px-5 py-2.5 rounded"
                style={{ background: "var(--secondary)", color: "var(--foreground)", fontSize: 13 }}
                onClick={() => setShowModal(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
