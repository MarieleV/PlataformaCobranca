import { useState } from "react"

interface Regra {
  id: string
  nome: string
  canal: "email" | "sms" | "whatsapp"
  prazo: number
  template: string
  ativa: boolean
  devedores: number
  taxaEntrega: string
}

// Estilos semânticos refinados (Tons pastéis para fundo, escuros para texto)
const canalStyles: Record<string, { badge: string, activeCard: string, text: string, toggle: string }> = {
  email: {
    badge: "bg-blue-50 text-blue-700 border-blue-200 shadow-sm",
    activeCard: "border-blue-500 shadow-md shadow-blue-500/10 ring-1 ring-blue-500",
    text: "text-blue-600",
    toggle: "bg-blue-500",
  },
  sms: {
    badge: "bg-violet-50 text-violet-700 border-violet-200 shadow-sm",
    activeCard: "border-violet-500 shadow-md shadow-violet-500/10 ring-1 ring-violet-500",
    text: "text-violet-600",
    toggle: "bg-violet-500",
  },
  whatsapp: {
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm",
    activeCard: "border-emerald-500 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-500",
    text: "text-emerald-600",
    toggle: "bg-emerald-500",
  },
}

const canalLabel: Record<string, string> = {
  email: "E-mail",
  sms: "SMS",
  whatsapp: "WhatsApp",
}

const initialRegras: Regra[] = [
  {
    id: "R01",
    nome: "Lembrete Antecipado",
    canal: "email",
    prazo: 5,
    template: "Olá {nome}, seu vencimento de R$ {valor} está se aproximando em {dias} dias.",
    ativa: true,
    devedores: 842,
    taxaEntrega: "98.4%",
  },
  {
    id: "R02",
    nome: "Cobrança Pós-Vencimento",
    canal: "sms",
    prazo: 15,
    template: "{nome}, sua dívida de R$ {valor} está em aberto há {dias} dias. Regularize: {link}",
    ativa: true,
    devedores: 617,
    taxaEntrega: "91.7%",
  },
  {
    id: "R03",
    nome: "Escalada de Cobrança",
    canal: "whatsapp",
    prazo: 30,
    template: "Prezado(a) {nome}, informamos que o débito de R$ {valor} está com {dias} dias de atraso. Evite restrições no CPF/CNPJ.",
    ativa: true,
    devedores: 389,
    taxaEntrega: "87.2%",
  },
  {
    id: "R04",
    nome: "Notificação Final",
    canal: "email",
    prazo: 60,
    template: "AVISO DE ENCAMINHAMENTO: {nome}, sua dívida de R$ {valor} será encaminhada para negativação em 72h.",
    ativa: false,
    devedores: 143,
    taxaEntrega: "—",
  },
]

const devedoresPipeline = [
  { nome: "Fernanda Assunção", cpf: "823.***.***.12", valor: "R$ 3.420,00", dias: 5, canal: "email", status: "aguardando" },
  { nome: "Marcos Tinoco ME", cpf: "22.487.***/0001-44", valor: "R$ 18.750,00", dias: 5, canal: "email", status: "aguardando" },
  { nome: "Rita Schommer", cpf: "512.***.***.88", valor: "R$ 890,00", dias: 5, canal: "email", status: "enviado" },
  { nome: "Cooperativa Alfa Ltda", cpf: "07.321.***/0001-19", valor: "R$ 42.100,00", dias: 15, canal: "sms", status: "falha" },
  { nome: "Paulo Rizzatto", cpf: "941.***.***.03", valor: "R$ 2.150,00", dias: 15, canal: "sms", status: "aguardando" },
]

const statusStyles: Record<string, string> = {
  aguardando: "bg-slate-100 text-slate-600 border-slate-200",
  enviado: "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm",
  falha: "bg-rose-50 text-rose-700 border-rose-200 shadow-sm",
}

// Função para renderizar o template destacando as variáveis {exemplo}
const renderTemplateString = (text: string) => {
  return text.split(/(\{.*?\})/g).map((part, i) => {
    if (part.startsWith("{") && part.endsWith("}")) {
      return (
        <span key={i} className="text-blue-700 font-bold bg-blue-50/80 px-1.5 py-0.5 rounded-md border border-blue-200 shadow-sm mx-0.5">
          {part}
        </span>
      )
    }
    return part
  })
}

export default function ReguaCobranca() {
  const [regras, setRegras] = useState(initialRegras)
  const [selectedId, setSelectedId] = useState("R01")

  const toggle = (id: string) => {
    setRegras((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ativa: !r.ativa } : r))
    )
  }

  const selected = regras.find((r) => r.id === selectedId)

  return (
    <div className="p-6 sm:p-8 overflow-y-auto h-full bg-slate-50 font-sans">
      
      {/* --- HEADER --- */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Régua de Cobrança
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Configure os canais, prazos e templates de comunicação por perfil de devedor.
          </p>
        </div>
        {/* Botão de Ação Principal: Mantido no Preto High-End */}
        <button className="self-start sm:self-auto px-5 py-2.5 rounded-xl bg-black hover:bg-slate-800 active:bg-slate-900 text-white text-sm font-bold shadow-xl shadow-black/10 transition-all flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
          Nova Regra
        </button>
      </div>

      {/* --- RULE CARDS GRID --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {regras.map((r) => {
          const active = selectedId === r.id
          const style = canalStyles[r.canal]

          return (
            <div
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={`rounded-2xl p-5 cursor-pointer transition-all duration-200 border bg-white ${
                active 
                  ? style.activeCard 
                  : "border-slate-200/80 hover:border-slate-300 shadow-sm"
              } ${!r.ativa && !active ? "opacity-60 grayscale-[0.3]" : ""}`}
            >
              <div className="flex items-start justify-between mb-4">
                <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold font-mono tracking-wider uppercase border ${style.badge}`}>
                  {canalLabel[r.canal]}
                </span>
                
                {/* Custom Toggle Switch adaptado com a cor do canal */}
                <button
                  onClick={(e) => { e.stopPropagation(); toggle(r.id) }}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                    r.ativa ? style.toggle : "bg-slate-200"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-200 shadow-sm ${
                      r.ativa ? "translate-x-4" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              <p className="font-bold text-slate-900 text-sm mb-1 line-clamp-1 tracking-tight" title={r.nome}>
                {r.nome}
              </p>
              <p className="text-xs font-mono font-bold text-slate-500 mb-4">
                D+{r.prazo}
              </p>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-auto">
                <span className="text-xs text-slate-500 font-medium">
                  <strong className="text-slate-900">{r.devedores}</strong> devedores
                </span>
                <span className={`text-xs font-bold font-mono ${style.text}`}>
                  {r.taxaEntrega}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* --- BOTTOM SECTION (Details + Table) --- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* DETAIL PANEL (Spans 5 columns) */}
        {selected && (
          <div className="lg:col-span-5 bg-white rounded-3xl p-7 border border-slate-200/80 shadow-sm flex flex-col h-full">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="font-bold text-lg text-slate-900 tracking-tight mb-0.5">{selected.nome}</p>
                <span className="font-mono text-[11px] font-bold text-slate-400 uppercase tracking-widest">{selected.id}</span>
              </div>
              <span className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${canalStyles[selected.canal].badge}`}>
                {canalLabel[selected.canal]}
              </span>
            </div>

            <div className="space-y-1 mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              {[
                { label: "Canal de Disparo", value: canalLabel[selected.canal] },
                { label: "Prazo da Régua", value: `D+${selected.prazo} (após vencimento)` },
                { label: "Status da Regra", value: selected.ativa ? "Ativa executando" : "Pausada" },
              ].map((f) => (
                <div key={f.label} className="flex items-center justify-between py-2 border-b border-slate-200/50 last:border-0">
                  <span className="text-xs font-medium text-slate-500">{f.label}</span>
                  <span className={`text-xs font-bold ${
                    f.label.includes("Status") 
                      ? selected.ativa ? canalStyles[selected.canal].text : "text-slate-400" 
                      : "text-slate-900"
                  }`}>
                    {f.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                Template de mensagem
              </p>
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 font-mono text-[13px] text-slate-700 leading-relaxed shadow-inner h-36 overflow-y-auto custom-scrollbar">
                {renderTemplateString(selected.template)}
              </div>
            </div>

            <div className="flex gap-3 mt-8 pt-6 border-t border-slate-100">
              <button className="flex-1 py-3 rounded-xl font-bold text-sm bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-black transition-colors shadow-sm">
                Editar Regra
              </button>
              <button className="px-5 py-3 rounded-xl font-bold text-sm bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors shadow-sm">
                Excluir
              </button>
            </div>
          </div>
        )}

        {/* PIPELINE TABLE (Spans 7 columns) */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
          <div className="px-7 py-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Devedores no Pipeline</h2>
              <p className="text-xs font-medium text-slate-500 mt-1">Próximos disparos programados para hoje, 08h00 BRT</p>
            </div>
          </div>
          
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50/50">
                <tr>
                  {["Devedor", "Valor", "D+", "Canal", "Status"].map((h) => (
                    <th key={h} className="px-7 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {devedoresPipeline.map((d, i) => (
                  <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-7 py-4">
                      <p className="font-bold text-slate-800 text-[13px]">{d.nome}</p>
                      <p className="font-mono text-[11px] font-medium text-slate-400 mt-0.5">{d.cpf}</p>
                    </td>
                    <td className="px-7 py-4">
                      <span className="font-mono text-xs font-bold text-slate-700">{d.valor}</span>
                    </td>
                    <td className="px-7 py-4">
                      <span className="font-mono text-xs font-bold text-slate-500">+{d.dias}</span>
                    </td>
                    <td className="px-7 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold font-mono tracking-wider uppercase border ${canalStyles[d.canal].badge}`}>
                        {canalLabel[d.canal]}
                      </span>
                    </td>
                    <td className="px-7 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1.5 rounded-md text-[10px] font-bold font-mono tracking-widest uppercase border ${statusStyles[d.status]}`}>
                        {d.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}