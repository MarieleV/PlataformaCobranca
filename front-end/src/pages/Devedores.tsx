import { useState } from "react"

interface Devedor {
  id: string
  nome: string
  cpf: string
  email: string
  valor: number
  dias: number
  status: "em_cobranca" | "quitado" | "negociando" | "sem_contato"
  ultimo_contato: string
  canal: string
}

const devedores: Devedor[] = [
  { id: "D-3847", nome: "Fernanda Assunção", cpf: "823.***.***.12", email: "f.assuncao@email.com", valor: 3420, dias: 5, status: "em_cobranca", ultimo_contato: "—", canal: "E-mail" },
  { id: "D-3846", nome: "Marcos Tinoco ME", cpf: "22.487.***/0001-44", email: "financeiro@tinoco.com.br", valor: 18750, dias: 5, status: "em_cobranca", ultimo_contato: "—", canal: "E-mail" },
  { id: "D-3845", nome: "Rita Schommer", cpf: "512.***.***.88", email: "rita.s@gmail.com", valor: 890, dias: 8, status: "em_cobranca", ultimo_contato: "29/07", canal: "E-mail" },
  { id: "D-3844", nome: "Cooperativa Alfa Ltda", cpf: "07.321.***/0001-19", email: "adm@coop-alfa.com.br", valor: 42100, dias: 15, status: "negociando", ultimo_contato: "28/07", canal: "SMS" },
  { id: "D-3843", nome: "Paulo Rizzatto", cpf: "941.***.***.03", email: "p.rizzatto@outlook.com", valor: 2150, dias: 15, status: "em_cobranca", ultimo_contato: "—", canal: "SMS" },
  { id: "D-3842", nome: "Clínica São Lucas S/S", cpf: "14.782.***/0001-88", email: "contato@sao-lucas.med.br", valor: 9800, dias: 22, status: "sem_contato", ultimo_contato: "15/07", canal: "WhatsApp" },
  { id: "D-3841", nome: "Heloizi Vargas", cpf: "334.***.***.71", email: "heloizi.v@email.com", valor: 650, dias: 30, status: "em_cobranca", ultimo_contato: "22/07", canal: "WhatsApp" },
  { id: "D-3840", nome: "Gustavo Lenz & Cia", cpf: "98.112.***/0001-55", email: "gustavo@lenz.com.br", valor: 5600, dias: 31, status: "em_cobranca", ultimo_contato: "21/07", canal: "WhatsApp" },
  { id: "D-3839", nome: "Ana Paula Kretzer", cpf: "102.***.***.44", email: "ana.kretzer@gmail.com", valor: 1280, dias: 45, status: "negociando", ultimo_contato: "18/07", canal: "E-mail" },
  { id: "D-3838", nome: "Supermercados Bom Preço", cpf: "33.991.***/0001-02", email: "financeiro@bompreco.com.br", valor: 87400, dias: 60, status: "em_cobranca", ultimo_contato: "10/07", canal: "E-mail" },
  { id: "D-3837", nome: "Luciana Fraga", cpf: "671.***.***.09", email: "lu.fraga@yahoo.com.br", valor: 340, dias: 62, status: "quitado", ultimo_contato: "28/07", canal: "SMS" },
  { id: "D-3836", nome: "Construtora Meridional", cpf: "55.210.***/0001-77", email: "obras@meridional.eng.br", valor: 124000, dias: 75, status: "sem_contato", ultimo_contato: "01/07", canal: "WhatsApp" },
]

const statusLabel: Record<string, string> = {
  em_cobranca: "Em cobrança",
  quitado: "Quitado",
  negociando: "Negociando",
  sem_contato: "Sem contato",
}

const statusStyles: Record<string, string> = {
  em_cobranca: "bg-blue-50 text-blue-700 border-blue-200",
  quitado: "bg-emerald-50 text-emerald-700 border-emerald-200",
  negociando: "bg-amber-50 text-amber-700 border-amber-200",
  sem_contato: "bg-rose-50 text-rose-700 border-rose-200",
}

export default function Devedores() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("todos")
  const [canalFilter, setCanalFilter] = useState("todos")

  const filtered = devedores.filter((d) => {
    const matchSearch =
      !search ||
      d.nome.toLowerCase().includes(search.toLowerCase()) ||
      d.cpf.includes(search)
    const matchStatus = statusFilter === "todos" || d.status === statusFilter
    const matchCanal = canalFilter === "todos" || d.canal.toLowerCase() === canalFilter
    return matchSearch && matchStatus && matchCanal
  })

  return (
    <div className="p-6 sm:p-8 overflow-y-auto h-full bg-slate-50 font-sans">
      
      {/* --- HEADER --- */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Devedores
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            <span className="font-semibold text-slate-700">{devedores.length}</span> devedores na carteira ativa · filtro aplicado: <span className="font-semibold text-slate-700">{filtered.length}</span>
          </p>
        </div>
        
        <button className="self-start sm:self-auto flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-xs font-semibold font-mono transition-all shadow-sm">
          <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Exportar CSV
        </button>
      </div>

      {/* --- FILTERS --- */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou CPF/CNPJ…"
          // Adicionado 'shadow-slate-200/50' para suavizar a sombra
          className="w-full sm:w-80 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm shadow-slate-200/50 placeholder:text-slate-400"
        />

        {/* SELECT: STATUS */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            // Adicionado 'shadow-slate-200/50' aqui também
            className="appearance-none w-full pl-3.5 pr-12 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm shadow-slate-200/50 cursor-pointer"
          >
            <option value="todos">Todos os status</option>
            <option value="em_cobranca">Em cobrança</option>
            <option value="negociando">Negociando</option>
            <option value="quitado">Quitado</option>
            <option value="sem_contato">Sem contato</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-500">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        

        {/* SELECT: CANAL */}
        <div className="relative">
          <select
            value={canalFilter}
            onChange={(e) => setCanalFilter(e.target.value)}
            className="appearance-none w-full pl-3.5 pr-12 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm shadow-slate-200/50 cursor-pointer"
          >
            <option value="todos">Todos os canais</option>
            <option value="e-mail">E-mail</option>
            <option value="sms">SMS</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-500">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* --- TABLE CONTAINER --- */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50/50">
              <tr>
                {["ID", "Devedor", "Valor", "Dias em atraso", "Canal", "Status", "Último contato"].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((d) => (
                <tr
                  key={d.id}
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4 font-mono text-xs font-medium text-slate-400">
                    {d.id}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-slate-900 text-[13px]">{d.nome}</p>
                    <p className="font-mono text-xs text-slate-400 mt-0.5">{d.cpf}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`font-mono text-xs font-bold ${
                      d.valor > 10000 ? "text-amber-600" : "text-slate-900"
                    }`}>
                      {d.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`font-mono text-xs font-bold ${
                      d.dias >= 60 ? "text-rose-600" : d.dias >= 30 ? "text-amber-600" : "text-slate-700"
                    }`}>
                      D+{d.dias}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-medium text-slate-600">{d.canal}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border ${statusStyles[d.status]}`}>
                      {statusLabel[d.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-400">
                    {d.ultimo_contato}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-sm text-slate-500 font-medium">Nenhum devedor encontrado com os filtros aplicados.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}