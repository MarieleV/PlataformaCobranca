import { useState } from "react"
import { AvisoErro, Badge, ICONE_DOWNLOAD, Painel, Spinner } from "../components/ui"
import { useApi } from "../hooks/useApi"
import { ApiError, apiBaixarArquivo } from "../lib/api"
import * as fmt from "../lib/formatos"
import { INTERVALO_POLLING_MS, NOME_CAMPO, emAndamento, nomeCsvDeErros } from "../lib/lotes"
import type { ErroLote, Lote } from "../lib/tipos"

const LOTES_NO_SELETOR = 50
const ERROS_POR_PAGINA = 100

interface RelatorioValidacaoProps {
  /** Lote a abrir (vindo do upload ou do dashboard). Sem ele, abre o mais recente. */
  loteId: string | null
  onSelecionarLote: (loteId: string) => void
  onImportar: () => void
}

export default function RelatorioValidacao({ loteId, onSelecionarLote, onImportar }: RelatorioValidacaoProps) {
  const lista = useApi<Lote[]>(`/lotes/?limit=${LOTES_NO_SELETOR}`, {
    intervaloMs: 10_000,
    pararQuando: (lotes) => !lotes.some(emAndamento),
  })
  const idSelecionado = loteId ?? lista.dados?.[0]?.id ?? null

  return (
    <div className="p-4 md:p-6 xl:p-8 overflow-y-auto h-full bg-slate-50 font-sans space-y-6">

      {/* --- HEADER --- */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Relatório de Validação
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Resultado da importação de cada lote e as linhas rejeitadas, com o motivo.
          </p>
        </div>
        {lista.dados && lista.dados.length > 0 && (
          <SeletorLote lotes={lista.dados} valor={idSelecionado} onChange={onSelecionarLote} />
        )}
      </div>

      {lista.erro && !lista.dados && (
        <AvisoErro mensagem={`Não foi possível carregar os lotes: ${lista.erro}`} onTentarNovamente={lista.recarregar} />
      )}

      {lista.carregando && !lista.dados ? (
        <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <Spinner className="h-4 w-4" /> Carregando lotes...
        </div>
      ) : lista.dados && lista.dados.length === 0 ? (
        <SemLotes onImportar={onImportar} />
      ) : idSelecionado ? (
        // key: ao trocar de lote, o detalhe recomeça do zero (página 1, sem filtro)
        <DetalheLote key={idSelecionado} loteId={idSelecionado} />
      ) : null}
    </div>
  )
}

function SeletorLote({ lotes, valor, onChange }: { lotes: Lote[]; valor: string | null; onChange: (id: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5 min-w-0 lg:min-w-[380px]">
      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Lote</span>
      <select
        value={valor ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-black focus:ring-4 focus:ring-black/5"
      >
        {/* Lote aberto por link que não está entre os 50 mais recentes */}
        {valor && !lotes.some((l) => l.id === valor) && <option value={valor}>Lote selecionado</option>}
        {lotes.map((l) => (
          <option key={l.id} value={l.id}>
            {l.nome_arquivo} · {fmt.dataHora(l.criado_em)} · {fmt.STATUS_LOTE[l.status].texto}
          </option>
        ))}
      </select>
    </label>
  )
}

function SemLotes({ onImportar }: { onImportar: () => void }) {
  return (
    <div className="rounded-2xl bg-white p-12 border border-slate-200/60 shadow-sm shadow-slate-200/50 text-center">
      <p className="font-bold text-slate-900 text-lg mb-1">Nenhum lote importado ainda</p>
      <p className="text-sm text-slate-500 mb-6">Importe uma planilha de devedores para ver o relatório de validação.</p>
      <button
        onClick={onImportar}
        className="px-5 py-3 rounded-xl bg-black hover:bg-slate-900 text-white font-semibold text-sm transition-all"
      >
        Importar lote
      </button>
    </div>
  )
}

// --- Detalhe do lote ----------------------------------------------------------

function DetalheLote({ loteId }: { loteId: string }) {
  const consulta = useApi<Lote>(`/lotes/${loteId}`, {
    intervaloMs: INTERVALO_POLLING_MS,
    pararQuando: (l) => !emAndamento(l),
  })
  const lote = consulta.dados

  if (consulta.erro && !lote) {
    return <AvisoErro mensagem={`Não foi possível carregar o lote: ${consulta.erro}`} onTentarNovamente={consulta.recarregar} />
  }
  if (!lote) {
    return (
      <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
        <Spinner className="h-4 w-4" /> Carregando lote...
      </div>
    )
  }

  const status = fmt.STATUS_LOTE[lote.status]
  const processando = emAndamento(lote)

  return (
    <div className="space-y-6">
      {/* Identificação */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-500">
        <span className="font-mono font-medium text-slate-700 bg-slate-200/60 px-1.5 py-0.5 rounded break-all">
          {lote.nome_arquivo}
        </span>
        <Badge texto={processando ? `${status.texto} · ${lote.progresso_percentual}%` : status.texto} classe={status.classe} />
        <span>
          Enviado em {fmt.dataHora(lote.criado_em)}
          {lote.finalizado_em && <> · Processado em {fmt.dataHora(lote.finalizado_em)}</>}
        </span>
      </div>

      {lote.status === "erro" && (
        <AvisoErro mensagem="O arquivo foi recusado por um problema estrutural (veja o motivo abaixo). Nenhum devedor deste arquivo foi importado." />
      )}

      <Numeros lote={lote} />
      <BarraDistribuicao lote={lote} />
      <TabelaErros lote={lote} />
    </div>
  )
}

function Numeros({ lote }: { lote: Lote }) {
  const total = lote.total_registros
  const pct = (parte: number) => (total > 0 ? fmt.percentual(Math.round((parte / total) * 1000) / 10) : null)
  const cards = [
    { rotulo: "Total de registros", valor: total, pct: null, cor: "" },
    { rotulo: "Novos devedores", valor: lote.total_importados, pct: pct(lote.total_importados), cor: "text-emerald-600" },
    { rotulo: "Atualizados", valor: lote.total_atualizados, pct: pct(lote.total_atualizados), cor: "text-blue-600" },
    { rotulo: "Linhas rejeitadas", valor: lote.total_rejeitados, pct: pct(lote.total_rejeitados), cor: "text-rose-600" },
  ]
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.rotulo} className="p-5 rounded-2xl bg-white border border-slate-200/60 shadow-sm shadow-slate-200/50">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{c.rotulo}</p>
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-3xl tracking-tight text-slate-900">{fmt.numero(c.valor)}</span>
            {c.pct && <span className={`font-mono text-xs font-semibold ${c.cor}`}>{c.pct}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

function BarraDistribuicao({ lote }: { lote: Lote }) {
  const total = lote.total_registros
  if (total <= 0) return null
  const largura = (n: number) => `${(n / total) * 100}%`
  const segmentos = [
    { cor: "bg-emerald-500", rotulo: "Novos", valor: lote.total_importados },
    { cor: "bg-blue-500", rotulo: "Atualizados", valor: lote.total_atualizados },
    { cor: "bg-rose-500", rotulo: "Rejeitados", valor: lote.total_rejeitados },
  ]
  return (
    <div className="rounded-2xl bg-white p-5 border border-slate-200/60 shadow-sm shadow-slate-200/50">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Distribuição do lote</p>
        <span className="text-xs font-mono text-slate-400">{lote.progresso_percentual}% processado</span>
      </div>
      <div className="h-3 w-full flex rounded-full overflow-hidden bg-slate-100 gap-0.5">
        {segmentos.map((s) =>
          s.valor > 0 ? (
            <div key={s.rotulo} style={{ width: largura(s.valor) }} className={`${s.cor} transition-all duration-500`} title={`${s.rotulo}: ${fmt.numero(s.valor)}`} />
          ) : null,
        )}
      </div>
      <div className="flex flex-wrap gap-6 mt-4">
        {segmentos.map((s) => (
          <div key={s.rotulo} className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${s.cor}`} />
            <span className="text-xs font-medium text-slate-600 font-mono">
              {s.rotulo} ({fmt.numero(s.valor)})
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Erros ------------------------------------------------------------------------

const CAMPOS_FILTRO = ["cpf_cnpj", "nome", "email", "valor_divida", "data_vencimento", "telefone", "whatsapp"]

function TabelaErros({ lote }: { lote: Lote }) {
  const [campo, setCampo] = useState("")
  const [pagina, setPagina] = useState(0)
  const [baixando, setBaixando] = useState(false)
  const [erroDownload, setErroDownload] = useState<string | null>(null)

  const query = new URLSearchParams({ skip: String(pagina * ERROS_POR_PAGINA), limit: String(ERROS_POR_PAGINA) })
  if (campo) query.set("campo", campo)
  // Enquanto o lote processa, novos erros vão aparecendo: recarrega junto com o lote
  const processando = emAndamento(lote)
  const erros = useApi<ErroLote[]>(`/lotes/${lote.id}/erros?${query}`, {
    intervaloMs: processando ? INTERVALO_POLLING_MS * 2 : undefined,
  })

  const lista = erros.dados ?? []
  const temProxima = lista.length === ERROS_POR_PAGINA
  const semErros = !erros.carregando && lista.length === 0 && pagina === 0

  const baixarCsv = async () => {
    setErroDownload(null)
    setBaixando(true)
    try {
      await apiBaixarArquivo(`/lotes/${lote.id}/erros/csv`, nomeCsvDeErros(lote))
    } catch (e) {
      setErroDownload(e instanceof ApiError ? e.message : "Erro inesperado ao baixar o CSV.")
    } finally {
      setBaixando(false)
    }
  }

  const trocarCampo = (novo: string) => {
    setCampo(novo)
    setPagina(0)
  }

  return (
    <Painel
      titulo="Problemas encontrados"
      subtitulo="Cada linha rejeitada pode ter mais de um problema (um por campo). A linha 1 é o cabeçalho da planilha."
      acao={
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={campo}
            onChange={(e) => trocarCampo(e.target.value)}
            aria-label="Filtrar por campo"
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 outline-none focus:border-black"
          >
            <option value="">Todos os campos</option>
            {CAMPOS_FILTRO.map((c) => (
              <option key={c} value={c}>{NOME_CAMPO[c]}</option>
            ))}
          </select>
          <button
            onClick={baixarCsv}
            disabled={baixando || (semErros && !campo)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-xs font-semibold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {baixando ? <Spinner className="h-4 w-4" /> : <span className="text-slate-500">{ICONE_DOWNLOAD}</span>}
            Exportar CSV de erros
          </button>
        </div>
      }
    >
      {erroDownload && (
        <div className="px-6 pt-4">
          <AvisoErro mensagem={`Não foi possível baixar o CSV: ${erroDownload}`} />
        </div>
      )}

      {erros.erro && !erros.dados ? (
        <div className="p-6">
          <AvisoErro mensagem={`Não foi possível carregar os erros: ${erros.erro}`} onTentarNovamente={erros.recarregar} />
        </div>
      ) : erros.carregando && !erros.dados ? (
        <div className="px-6 py-10 flex items-center justify-center gap-2 text-sm font-medium text-slate-500">
          <Spinner className="h-4 w-4" /> Carregando...
        </div>
      ) : lista.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm font-medium text-slate-400">
          {campo
            ? `Nenhum problema no campo ${NOME_CAMPO[campo] ?? campo}.`
            : processando
              ? "Nenhum problema encontrado até agora..."
              : "Nenhuma linha rejeitada. Todos os registros foram importados. ✓"}
        </p>
      ) : (
        <div className={`overflow-x-auto transition-opacity ${erros.carregando ? "opacity-60" : ""}`}>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/50">
              <tr>
                {["Linha", "Campo", "Valor informado", "Problema"].map((h) => (
                  <th key={h} className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lista.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50/80 transition-colors align-top">
                  <td className="px-6 py-4 font-mono text-xs font-medium text-slate-500 whitespace-nowrap">#{e.numero_linha}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-mono text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100" title={e.campo}>
                      {NOME_CAMPO[e.campo] ?? e.campo}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-800 max-w-[260px] break-all">
                    {e.valor_informado || <span className="text-slate-400 italic">(vazio)</span>}
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-rose-700 min-w-[240px]">{e.regra_violada}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(pagina > 0 || temProxima) && (
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>
            Página {pagina + 1} · problemas {fmt.numero(pagina * ERROS_POR_PAGINA + 1)}–{fmt.numero(pagina * ERROS_POR_PAGINA + lista.length)}
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
              disabled={!temProxima}
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Próxima →
            </button>
          </div>
        </div>
      )}
    </Painel>
  )
}
