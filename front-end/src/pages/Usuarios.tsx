import { useState } from "react"

interface Usuario {
  id: string
  nome: string
  email: string
  perfil: "admin" | "gestor" | "operador"
  status: "ativo" | "inativo"
  ultimo_acesso: string
}

const usuarios: Usuario[] = [
  { id: "U-001", nome: "Mariele Vieira da Silva", email: "mariele.vieira@consulth.com.br", perfil: "admin", status: "ativo", ultimo_acesso: "30/07 08:01" },
  { id: "U-002", nome: "Fellipe Junkes", email: "fellipe.junkes@consulth.com.br", perfil: "gestor", status: "ativo", ultimo_acesso: "29/07 17:42" },
  { id: "U-003", nome: "Heloizi Vargas", email: "heloizi.vargas@coop-sc.com.br", perfil: "operador", status: "ativo", ultimo_acesso: "30/07 07:55" },
  { id: "U-004", nome: "Rodrigo Becker", email: "r.becker@coop-sc.com.br", perfil: "operador", status: "ativo", ultimo_acesso: "28/07 13:10" },
  { id: "U-005", nome: "Aline Moraes", email: "aline.moraes@consulth.com.br", perfil: "gestor", status: "inativo", ultimo_acesso: "15/07 09:30" },
]

// Estilos semânticos refinados (Tons pastéis para fundo, escuros para texto)
const perfilStyles: Record<string, { badge: string, avatarBg: string, avatarText: string }> = {
  admin: {
    badge: "bg-rose-50 text-rose-700 border-rose-200 shadow-sm",
    avatarBg: "bg-rose-100/80",
    avatarText: "text-rose-700",
  },
  gestor: {
    badge: "bg-violet-50 text-violet-700 border-violet-200 shadow-sm",
    avatarBg: "bg-violet-100/80",
    avatarText: "text-violet-700",
  },
  operador: {
    badge: "bg-blue-50 text-blue-700 border-blue-200 shadow-sm",
    avatarBg: "bg-blue-100/80",
    avatarText: "text-blue-700",
  },
}

const perfilLabel: Record<string, string> = {
  admin: "Administrador",
  gestor: "Gestor",
  operador: "Operador",
}

export default function Usuarios() {
  const [showModal, setShowModal] = useState(false)

  return (
    <div className="p-6 sm:p-8 overflow-y-auto h-full bg-slate-50 font-sans">
      
      {/* --- HEADER --- */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Gestão de Usuários
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Apenas administradores podem gerenciar usuários e permissões (RN06).
          </p>
        </div>
        {/* Botão Principal no estilo Black High-End */}
        <button
          onClick={() => setShowModal(true)}
          className="self-start sm:self-auto px-5 py-2.5 rounded-xl bg-black hover:bg-slate-800 active:bg-slate-900 text-white text-sm font-bold shadow-xl shadow-black/10 transition-all flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Convidar Usuário
        </button>
      </div>

      {/* --- PERFIL LEGEND CARDS --- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { perfil: "admin", desc: "Acesso total: usuários, régua, importação, monitoramento" },
          { perfil: "gestor", desc: "Dashboard, régua, devedores, monitoramento" },
          { perfil: "operador", desc: "Importação de lotes, lista de devedores" },
        ].map((p) => {
          const style = perfilStyles[p.perfil]
          return (
            <div
              key={p.perfil}
              className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm transition-all hover:border-slate-300"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold font-mono tracking-wider uppercase border ${style.badge}`}>
                  {p.perfil}
                </span>
              </div>
              <p className="text-xs font-medium text-slate-500 leading-relaxed">{p.desc}</p>
            </div>
          )
        })}
      </div>

      {/* --- TABLE CONTAINER --- */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50/50">
              <tr>
                {["ID", "Nome", "E-mail", "Perfil", "Status", "Último acesso", "Ações"].map((h) => (
                  <th
                    key={h}
                    className="px-7 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {usuarios.map((u) => {
                const style = perfilStyles[u.perfil]
                return (
                  <tr
                    key={u.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="px-7 py-4 font-mono text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                      {u.id}
                    </td>
                    <td className="px-7 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold ${style.avatarBg} ${style.avatarText} flex-shrink-0 shadow-sm`}
                        >
                          {u.nome.split(" ").slice(0, 2).map((n) => n[0]).join("")}
                        </div>
                        <span className="text-slate-900 font-bold text-[13px] tracking-tight">{u.nome}</span>
                      </div>
                    </td>
                    <td className="px-7 py-4 font-mono text-[11px] font-medium text-slate-500">
                      {u.email}
                    </td>
                    <td className="px-7 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold font-mono tracking-wider uppercase border ${style.badge}`}>
                        {perfilLabel[u.perfil]}
                      </span>
                    </td>
                    <td className="px-7 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1.5 rounded-md text-[10px] font-bold font-mono tracking-widest uppercase border ${
                        u.status === "ativo" 
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                          : "bg-slate-50 text-slate-500 border-slate-200"
                      }`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-7 py-4 font-mono text-xs font-medium text-slate-500">
                      {u.ultimo_acesso}
                    </td>
                    <td className="px-7 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 hover:text-black transition-colors shadow-sm"
                        >
                          Editar
                        </button>
                        {u.status === "ativo" && (
                          <button
                            className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-rose-600 text-xs font-bold hover:bg-rose-50 transition-colors shadow-sm"
                          >
                            Desativar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- INVITE MODAL --- */}
      {showModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 bg-slate-900/40 backdrop-blur-sm p-4 transition-all"
          onClick={() => setShowModal(false)}
        >
          <div
            className="rounded-3xl bg-white p-7 sm:p-9 border border-slate-200/80 shadow-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-slate-900 tracking-tight mb-1">
              Convidar novo usuário
            </h3>
            <p className="text-sm font-medium text-slate-500 mb-8">
              Um e-mail de convite com link de acesso será enviado.
            </p>
            
            <div className="space-y-5">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Nome completo</label>
                <input
                  placeholder="ex: João da Silva"
                  className="w-full px-4 py-3.5 rounded-xl bg-slate-50/50 border border-slate-200 text-slate-900 text-sm font-medium focus:bg-white focus:outline-none focus:ring-4 focus:ring-black/5 focus:border-black transition-all placeholder:text-slate-400"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">E-mail corporativo</label>
                <input
                  placeholder="joao@empresa.com.br"
                  className="w-full px-4 py-3.5 rounded-xl bg-slate-50/50 border border-slate-200 text-slate-900 text-sm font-medium focus:bg-white focus:outline-none focus:ring-4 focus:ring-black/5 focus:border-black transition-all placeholder:text-slate-400"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Perfil de acesso</label>
                <select
                  className="w-full px-4 py-3.5 rounded-xl bg-slate-50/50 border border-slate-200 text-slate-900 text-sm font-medium focus:bg-white focus:outline-none focus:ring-4 focus:ring-black/5 focus:border-black transition-all cursor-pointer"
                >
                  <option value="operador">Operador</option>
                  <option value="gestor">Gestor</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-10">
              <button
                className="flex-1 py-3.5 rounded-xl bg-black hover:bg-slate-900 active:scale-[0.99] text-white text-sm font-bold shadow-xl shadow-black/10 transition-all"
                onClick={() => setShowModal(false)}
              >
                Enviar convite
              </button>
              <button
                className="px-6 py-3.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-black text-sm font-bold transition-all shadow-sm"
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