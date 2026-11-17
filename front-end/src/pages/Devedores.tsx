import { useState } from "react"
import DetalheDevedor from "../components/DetalheDevedor"
import { CONTEUDO, ID, inputClasse, PAGINA, SUPERFICIE, TABELA, TBODY, TD, TD_NUM, TH, TH_NUM, THEAD, TR_CLICAVEL } from "../components/estilos"
import {
  Aviso,
  AvisoErro,
  Badge,
  BOTAO_FANTASMA,
  BOTAO_SECUNDARIO_P,
  CabecalhoPagina,
  EsqueletoTabela,
  Paginacao,
  Selecao,
  Vazio,
} from "../components/ui"
import { useApi } from "../hooks/useApi"
import { useDebounce } from "../hooks/useDebounce"
import * as fmt from "../lib/formatos"
import type { Canal, Devedor, Pagina, StatusDevedor } from "../lib/tipos"

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
const CANAIS: Canal[] = ["email", "sms", "whatsapp"]

interface DevedoresProps {
  onAbrirLote?: (loteId: string) => void
}

export default function Devedores({ onAbrirLote }: DevedoresProps) {
  const [busca, setBusca] = useState("")
  const [status, setStatus] = useState<StatusDevedor | "">("")
  const [atraso, setAtraso] = useState("")
  const [canal, setCanal] = useState<Canal | "">("")
  const [pagina, setPagina] = useState(0)
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const buscaAtrasada = useDebounce(busca.trim(), 400)
  const buscaCurta = buscaAtrasada.length > 0 && buscaAtrasada.length < BUSCA_MINIMA

  const query = new URLSearchParams({ skip: String(pagina * POR_PAGINA), limit: String(POR_PAGINA) })
  if (status) query.set("status", status)
  if (atraso) query.set("atraso_minimo", atraso)
  if (canal) query.set("canal", canal)
  if (buscaAtrasada.length >= BUSCA_MINIMA) query.set("busca", buscaAtrasada)

  const consulta = useApi<Pagina<Devedor>>(`/devedores/?${query}`)
  const dados = consulta.dados
  const totalPaginas = dados ? Math.max(1, Math.ceil(dados.total / POR_PAGINA)) : 1
  const filtrando = Boolean(status || atraso || canal || buscaAtrasada.length >= BUSCA_MINIMA)

  // Qualquer filtro novo volta para a primeira página
  const comFiltro = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v)
    setPagina(0)
  }

  const limpar = () => {
    setBusca("")
    setStatus("")
    setAtraso("")
    setCanal("")
    setPagina(0)
  }

  return (
    <div className={PAGINA}>
      <div className={CONTEUDO}>
        <CabecalhoPagina
          titulo="Devedores"
          descricao={
            dados ? (
              <>
                <span className="font-medium text-slate-800">{fmt.numero(dados.total)}</span>{" "}
                {filtrando ? "encontrados com os filtros aplicados" : "devedores na base"}, ordenados do vencimento mais antigo.
              </>
            ) : (
              "Carteira de devedores importados pelos lotes."
            )
          }
        />

        {aviso && <Aviso tipo="sucesso" onFechar={() => setAviso(null)}>{aviso}</Aviso>}

        <section className={`${SUPERFICIE} overflow-hidden`}>
          {/* --- FILTROS --- */}
          <div className="p-4 sm:px-6 border-b border-slate-200 flex flex-wrap items-start gap-3">
            <div className="w-full sm:w-80">
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
                  </svg>
                </span>
                <input
                  value={busca}
                  onChange={(e) => { setBusca(e.target.value); setPagina(0) }}
                  placeholder="Buscar por nome ou CPF/CNPJ"
                  aria-label="Buscar por nome ou CPF/CNPJ"
                  className={`${inputClasse()} pl-9`}
                />
              </div>
              {buscaCurta && <p className="text-xs text-slate-500 mt-1.5">Digite pelo menos {BUSCA_MINIMA} caracteres.</p>}
            </div>

            <Selecao
              value={status}
              onChange={(e) => comFiltro((v: string) => setStatus(v as StatusDevedor | ""))(e.target.value)}
              aria-label="Filtrar por status"
              className="w-full sm:w-48"
            >
              <option value="">Todos os status</option>
              {STATUS.map((s) => <option key={s} value={s}>{fmt.STATUS_DEVEDOR[s].texto}</option>)}
            </Selecao>
            <Selecao
              value={atraso}
              onChange={(e) => comFiltro(setAtraso)(e.target.value)}
              aria-label="Filtrar por atraso"
              className="w-full sm:w-56"
            >
              {FILTROS_ATRASO.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
            </Selecao>
            {/* RF05: só quem tem o contato do canal (e-mail, telefone para SMS ou WhatsApp) */}
            <Selecao
              value={canal}
              onChange={(e) => comFiltro((v: string) => setCanal(v as Canal | ""))(e.target.value)}
              aria-label="Filtrar por canal"
              className="w-full sm:w-52"
            >
              <option value="">Todos os canais</option>
              {CANAIS.map((c) => <option key={c} value={c}>Com {fmt.NOME_CANAL[c]}</option>)}
            </Selecao>

            {filtrando && (
              <button onClick={limpar} className={BOTAO_FANTASMA}>
                Limpar filtros
              </button>
            )}
          </div>

          {consulta.erro && (
            <div className="p-4 sm:px-6 border-b border-slate-200">
              <AvisoErro mensagem={`Não foi possível carregar os devedores: ${consulta.erro}`} onTentarNovamente={consulta.recarregar} />
            </div>
          )}

          {/* --- TABELA --- */}
          {!dados && consulta.carregando ? (
            <EsqueletoTabela rotulo="Carregando devedores" />
          ) : dados && dados.itens.length === 0 ? (
            filtrando ? (
              <Vazio
                titulo="Nenhum devedor encontrado"
                descricao="Nenhum devedor corresponde aos filtros aplicados. Ajuste a busca ou limpe os filtros."
                acao={<button onClick={limpar} className={BOTAO_SECUNDARIO_P}>Limpar filtros</button>}
              />
            ) : (
              <Vazio titulo="Nenhum devedor na base" descricao="Importe um lote em csv, xlsx ou xls para começar a cobrança." />
            )
          ) : dados ? (
            <div className={`overflow-x-auto transition-opacity ${consulta.carregando ? "opacity-60" : ""}`}>
              <table className={TABELA}>
                <thead className={THEAD}>
                  <tr>
                    <th className={TH}>Devedor</th>
                    <th className={TH_NUM}>Valor</th>
                    <th className={TH}>Vencimento</th>
                    <th className={TH}>Atraso</th>
                    <th className={TH}>Contatos</th>
                    <th className={TH}>Status</th>
                  </tr>
                </thead>
                <tbody className={TBODY}>
                  {dados.itens.map((d) => (
                    <tr
                      key={d.id}
                      onClick={() => setSelecionado(d.id)}
                      onKeyDown={(e) => { if (e.key === "Enter") setSelecionado(d.id) }}
                      tabIndex={0}
                      className={TR_CLICAVEL}
                    >
                      <td className={TD}>
                        <p className="font-medium text-slate-950 max-w-[280px] truncate">{d.nome}</p>
                        <p className={`${ID} mt-0.5`}>{fmt.documentoMascarado(d.cpf_cnpj)}</p>
                      </td>
                      <td className={`${TD_NUM} font-medium text-slate-950`}>{fmt.moeda(d.valor_divida)}</td>
                      <td className={`${TD} text-slate-500`}>{fmt.data(d.data_vencimento)}</td>
                      <td className={TD}>
                        <MarcaAtraso dias={d.dias_atraso} />
                      </td>
                      <td className={TD}>
                        <Contatos devedor={d} />
                      </td>
                      <td className={TD}>
                        <Badge texto={fmt.STATUS_DEVEDOR[d.status].texto} classe={fmt.STATUS_DEVEDOR[d.status].classe} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {dados && dados.total > POR_PAGINA && (
            <Paginacao
              inicio={fmt.numero(pagina * POR_PAGINA + 1)}
              fim={fmt.numero(pagina * POR_PAGINA + dados.itens.length)}
              total={fmt.numero(dados.total)}
              pagina={pagina}
              totalPaginas={totalPaginas}
              onAnterior={() => setPagina((p) => p - 1)}
              onProxima={() => setPagina((p) => p + 1)}
            />
          )}
        </section>

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
    </div>
  )
}

const ESCALA_ATRASO = 90 // a marca chega ao fim da régua em D+90

/** D+N com uma pequena régua: a marca anda conforme o atraso (cor muda em D+30 e D+60). */
function MarcaAtraso({ dias }: { dias: number }) {
  if (dias <= 0) return <span className="text-slate-500">A vencer</span>
  const posicao = Math.min(dias, ESCALA_ATRASO) / ESCALA_ATRASO
  return (
    <span className="inline-flex items-center gap-3">
      <span className={`w-14 font-medium ${fmt.corAtraso(dias)}`}>D+{dias}</span>
      <span className="relative w-16 h-2 hidden md:block" aria-hidden="true">
        <span className="absolute inset-x-0 top-1/2 h-px bg-slate-200" />
        {[30, 60].map((t) => (
          <span key={t} className="absolute top-0 bottom-0 w-px bg-slate-300" style={{ left: `${(t / ESCALA_ATRASO) * 100}%` }} />
        ))}
        <span
          className={`absolute top-1/2 w-2 h-2 -mt-1 -ml-1 rounded-full ring-2 ring-white ${fmt.fundoAtraso(dias)}`}
          style={{ left: `${posicao * 100}%` }}
        />
      </span>
    </span>
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
    <div className="flex items-center gap-1">
      {canais.map(({ canal, tem }) => (
        <span
          key={canal}
          title={`${fmt.NOME_CANAL[canal]}: ${tem ? "cadastrado" : "não cadastrado"}`}
          className={`inline-flex items-center h-6 px-1.5 rounded-md text-xs ${
            tem ? "text-slate-700 bg-slate-100" : "text-slate-400 line-through decoration-slate-300"
          }`}
        >
          {fmt.NOME_CANAL[canal]}
        </span>
      ))}
    </div>
  )
}
