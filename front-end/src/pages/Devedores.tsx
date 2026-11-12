import { useState } from "react"
import DetalheDevedor from "../components/DetalheDevedor"
import { AvisoErro, Badge, Spinner } from "../components/ui"
import { useApi } from "../hooks/useApi"
import { useDebounce } from "../hooks/useDebounce"
import * as fmt from "../lib/formatos"
import type { Devedor, Pagina, StatusDevedor } from "../lib/tipos"

const POR_PAGINA = 50
const BUSCA_MINIMA = 2 // a API exige pelo menos 2 caracteres

const FILTROS_ATRASO = [
  { valor: "", texto: "Qualquer atraso" },
  { valor: "1", texto: "Vencidos (D+1 ou mais)" },
  { valor: "15", texto: "D+15 ou mais" },
  { valor: "30", texto: "D+30 ou mais" },
  { valor: "60", texto: "D+60 ou mais" },
  { valor: "90", texto: "D+90 ou mais" },
]

const STATUS: StatusDevedor[] = ["ativo", "comunicado", "negociando", "quitado", "inativo"]

const SELECT =
  "appearance-none w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all shadow-sm shadow-slate-200/50 cursor-pointer"

interface DevedoresProps {
  onAbrirLote?: (loteId: string) => void
}

export default function Devedores({ onAbrirLote }: DevedoresProps) {
  const [busca, setBusca] = useState("")
  const [status, setStatus] = useState<StatusDevedor | "">("")
  const [atraso, setAtraso] = useState("")
  const [pagina, setPagina] = useState(0)
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const buscaAtrasada = useDebounce(busca.trim(), 400)
  const buscaCurta = buscaAtrasada.length > 0 && buscaAtrasada.length < BUSCA_MINIMA

  const query = new URLSearchParams({ skip: String(pagina * POR_PAGINA), limit: String(POR_PAGINA) })
  if (status) query.set("status", status)
  if (atraso) query.set("atraso_minimo", atraso)
  if (buscaAtrasada.length >= BUSCA_MINIMA) query.set("busca", buscaAtrasada)

  const consulta = useApi<Pagina<Devedor>>(`/devedores/?${query}`)
  const dados = consulta.dados
  const totalPaginas = dados ? Math.max(1, Math.ceil(dados.total / POR_PAGINA)) : 1
  const filtrando = Boolean(status || atraso || buscaAtrasada.length >= BUSCA_MINIMA)

  // Qualquer filtro novo volta para a primeira página
  const comFiltro = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v)
    setPagina(0)
  }

  const limpar = () => {
    setBusca("")
    setStatus("")
    setAtraso("")
    setPagina(0)
  }

  return (
    <div className="p-4 md:p-6 xl:p-8 overflow-y-auto h-full bg-slate-50 font-sans">

      {/* --- HEADER --- */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Devedores
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {dados ? (
            <>
              <span className="font-semibold text-slate-700">{fmt.numero(dados.total)}</span>{" "}
              {filtrando ? "encontrados com os filtros aplicados" : "devedores na base"} · ordenados do vencimento mais antigo
            </>
          ) : (
            "Carteira de devedores importados pelos lotes."
          )}
        </p>
      </div>

      {aviso && (
        <div className="mb-6 flex items-center justify-between gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl" role="status">
          <p className="text-sm font-semibold text-emerald-700">{aviso}</p>
          <button onClick={() => setAviso(null)} className="text-xs font-bold text-emerald-700 hover:underline">Fechar</button>
        </div>
      )}

      {/* --- FILTROS --- */}
      <div className="flex flex-wrap items-start gap-3 mb-6">
        <div className="w-full sm:w-80">
          <input
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setPagina(0) }}
            placeholder="Buscar por nome ou CPF/CNPJ…"
            aria-label="Buscar por nome ou CPF/CNPJ"
            className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all shadow-sm shadow-slate-200/50 placeholder:text-slate-400"
          />
          {buscaCurta && <p className="text-xs text-slate-400 mt-1 ml-1">Digite pelo menos {BUSCA_MINIMA} caracteres.</p>}
        </div>

        <Seletor
          valor={status}
          onChange={comFiltro((v: string) => setStatus(v as StatusDevedor | ""))}
          rotulo="Filtrar por status"
          opcoes={[{ valor: "", texto: "Todos os status" }, ...STATUS.map((s) => ({ valor: s, texto: fmt.STATUS_DEVEDOR[s].texto }))]}
        />
        <Seletor valor={atraso} onChange={comFiltro(setAtraso)} rotulo="Filtrar por atraso" opcoes={FILTROS_ATRASO} />

        {filtrando && (
          <button onClick={limpar} className="px-3 py-2.5 text-xs font-bold text-slate-500 hover:text-black">
            Limpar filtros
          </button>
        )}
      </div>

      {consulta.erro && (
        <div className="mb-6">
          <AvisoErro mensagem={`Não foi possível carregar os devedores: ${consulta.erro}`} onTentarNovamente={consulta.recarregar} />
        </div>
      )}

      {/* --- TABELA --- */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        {!dados && consulta.carregando ? (
          <div className="py-16 flex items-center justify-center gap-2 text-sm font-medium text-slate-500">
            <Spinner /> Carregando devedores...
          </div>
        ) : dados && dados.itens.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-slate-500 font-medium">
              {filtrando ? "Nenhum devedor encontrado com os filtros aplicados." : "Nenhum devedor na base. Importe um lote para começar."}
            </p>
          </div>
        ) : dados ? (
          <div className={`overflow-x-auto transition-opacity ${consulta.carregando ? "opacity-60" : ""}`}>
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50/50">
                <tr>
                  {["Devedor", "Valor", "Vencimento", "Atraso", "Contatos", "Status"].map((h) => (
                    <th key={h} className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dados.itens.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => setSelecionado(d.id)}
                    onKeyDown={(e) => { if (e.key === "Enter") setSelecionado(d.id) }}
                    tabIndex={0}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer outline-none focus-visible:bg-slate-100"
                  >
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-900 text-[13px] max-w-[280px] truncate">{d.nome}</p>
                      <p className="font-mono text-xs text-slate-400 mt-0.5">{fmt.documentoMascarado(d.cpf_cnpj)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs font-bold text-slate-900">{fmt.moeda(d.valor_divida)}</span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">{fmt.data(d.data_vencimento)}</td>
                    <td className="px-6 py-4">
                      <span className={`font-mono text-xs font-bold ${fmt.corAtraso(d.dias_atraso)}`}>
                        {d.dias_atraso > 0 ? `D+${d.dias_atraso}` : "A vencer"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Contatos devedor={d} />
                    </td>
                    <td className="px-6 py-4">
                      <Badge texto={fmt.STATUS_DEVEDOR[d.status].texto} classe={fmt.STATUS_DEVEDOR[d.status].classe} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {dados && dados.total > POR_PAGINA && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>
              {fmt.numero(pagina * POR_PAGINA + 1)}–{fmt.numero(pagina * POR_PAGINA + dados.itens.length)} de {fmt.numero(dados.total)} · página {pagina + 1} de {totalPaginas}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPagina((p) => p - 1)}
                disabled={pagina === 0}
                className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Anterior
              </button>
              <button
                onClick={() => setPagina((p) => p + 1)}
                disabled={pagina + 1 >= totalPaginas}
                className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Próxima →
              </button>
            </div>
          </div>
        )}
      </div>

      {selecionado && (
        <DetalheDevedor
          devedorId={selecionado}
          onFechar={() => setSelecionado(null)}
          onAlterado={consulta.recarregar}
          onExcluido={(nome) => {
            setSelecionado(null)
            setAviso(`Devedor ${nome} excluído, com todo o histórico de comunicações.`)
            consulta.recarregar()
          }}
          onAbrirLote={onAbrirLote}
        />
      )}
    </div>
  )
}

function Seletor({ valor, onChange, rotulo, opcoes }: {
  valor: string
  onChange: (v: string) => void
  rotulo: string
  opcoes: { valor: string; texto: string }[]
}) {
  return (
    <div className="relative">
      <select value={valor} onChange={(e) => onChange(e.target.value)} aria-label={rotulo} className={SELECT}>
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>{o.texto}</option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-slate-500">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  )
}

/** Quais canais o devedor pode receber (o canal só dispara se houver o contato). */
function Contatos({ devedor }: { devedor: Devedor }) {
  const canais = [
    { canal: "email" as const, tem: Boolean(devedor.email) },
    { canal: "sms" as const, tem: Boolean(devedor.telefone) },
    { canal: "whatsapp" as const, tem: Boolean(devedor.whatsapp) },
  ]
  return (
    <div className="flex items-center gap-1.5">
      {canais.map(({ canal, tem }) => (
        <span
          key={canal}
          title={`${fmt.NOME_CANAL[canal]}: ${tem ? "cadastrado" : "não cadastrado"}`}
          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
            tem ? "text-slate-700 bg-white border-slate-200" : "text-slate-300 bg-slate-50 border-slate-100 line-through"
          }`}
        >
          {canal === "email" ? "E-mail" : canal === "sms" ? "SMS" : "Wpp"}
        </span>
      ))}
    </div>
  )
}
