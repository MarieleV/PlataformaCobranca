import { useState } from "react"
import { CONTEUDO, PAGINA, SUPERFICIE, TD, TH, THEAD } from "../components/estilos"
import {
  AvisoErro,
  Aviso,
  Badge,
  BOTAO_PRIMARIO,
  BOTAO_SECUNDARIO,
  BOTAO_SECUNDARIO_P,
  CabecalhoPagina,
  EsqueletoTabela,
  IconeDownload,
  Painel,
  Selecao,
  Spinner,
  Vazio,
} from "../components/ui"
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
    <div className={PAGINA}>
      <div className={CONTEUDO}>
        <CabecalhoPagina
          titulo="Relatório de validação"
          descricao="Resultado da importação de cada lote e as linhas rejeitadas, com o motivo."
          acoes={lista.dados && lista.dados.length > 0 && (
            <SeletorLote lotes={lista.dados} valor={idSelecionado} onChange={onSelecionarLote} />
          )}
        />

        {lista.erro && !lista.dados && (
          <AvisoErro mensagem={`Não foi possível carregar os lotes: ${lista.erro}`} onTentarNovamente={lista.recarregar} />
        )}

        {lista.carregando && !lista.dados ? (
          <EsqueletoLote />
        ) : lista.dados && lista.dados.length === 0 ? (
          <section className={SUPERFICIE}>
            <Vazio
              titulo="Nenhum lote importado ainda"
              descricao="Importe uma planilha de devedores para ver o relatório de validação."
              acao={<button onClick={onImportar} className={BOTAO_PRIMARIO}>Importar lote</button>}
            />
          </section>
        ) : idSelecionado ? (
          // key: ao trocar de lote, o detalhe recomeça do zero (página 1, sem filtro)
          <DetalheLote key={idSelecionado} loteId={idSelecionado} />
        ) : null}
      </div>
    </div>
  )
}

function SeletorLote({ lotes, valor, onChange }: { lotes: Lote[]; valor: string | null; onChange: (id: string) => void }) {
  return (
    <Selecao
      value={valor ?? ""}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Lote"
      className="w-full lg:w-[420px]"
    >
      {/* Lote aberto por link que não está entre os 50 mais recentes */}
      {valor && !lotes.some((l) => l.id === valor) && <option value={valor}>Lote selecionado</option>}
      {lotes.map((l) => (
        <option key={l.id} value={l.id}>
          {l.nome_arquivo}, {fmt.dataHora(l.criado_em)} ({fmt.STATUS_LOTE[l.status].texto})
        </option>
      ))}
    </Selecao>
  )
}

function EsqueletoLote() {
  return (
    <div className="space-y-6 animate-pulse" role="status" aria-label="Carregando lote">
      <div className={`${SUPERFICIE} h-[180px]`} />
      <div className={`${SUPERFICIE} h-[280px]`} />
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
  if (!lote) return <EsqueletoLote />

  const status = fmt.STATUS_LOTE[lote.status]
  const processando = emAndamento(lote)

  return (
    <div className="space-y-6">
      {lote.status === "erro" && (
        <AvisoErro mensagem="O arquivo foi recusado por um problema estrutural (veja o motivo abaixo). Nenhum devedor deste arquivo foi importado." />
      )}

      <section className={`${SUPERFICIE} overflow-hidden`}>
        {/* Identificação */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className="text-base font-semibold text-slate-950 break-all">{lote.nome_arquivo}</h2>
          <Badge texto={processando ? `${status.texto}, ${lote.progresso_percentual}%` : status.texto} classe={status.classe} />
          <span className="text-[13px] text-slate-500">
            Enviado em {fmt.dataHora(lote.criado_em)}
            {lote.finalizado_em && <>, processado em {fmt.dataHora(lote.finalizado_em)}</>}
          </span>
        </div>
        <Numeros lote={lote} />
        <BarraDistribuicao lote={lote} />
      </section>

      <TabelaErros lote={lote} />
    </div>
  )
}

function Numeros({ lote }: { lote: Lote }) {
  const total = lote.total_registros
  const pct = (parte: number) => (total > 0 ? fmt.percentual(Math.round((parte / total) * 1000) / 10) : null)
  const itens = [
    { rotulo: "Total de registros", valor: total, pct: null, cor: "text-slate-950" },
    { rotulo: "Novos devedores", valor: lote.total_importados, pct: pct(lote.total_importados), cor: "text-slate-950" },
    { rotulo: "Atualizados", valor: lote.total_atualizados, pct: pct(lote.total_atualizados), cor: "text-slate-950" },
    {
      rotulo: "Linhas rejeitadas",
      valor: lote.total_rejeitados,
      pct: pct(lote.total_rejeitados),
      cor: lote.total_rejeitados > 0 ? "text-rose-700" : "text-slate-400",
    },
  ]
  return (
    <dl className="grid grid-cols-2 lg:grid-cols-4 overflow-hidden">
      {itens.map((c) => (
        <div key={c.rotulo} className="px-5 sm:px-6 py-5 -ml-px -mt-px border-l border-t border-slate-200">
          <dt className="text-[13px] text-slate-500">{c.rotulo}</dt>
          <dd className="mt-1.5 flex items-baseline gap-2">
            <span className={`font-semibold text-3xl tracking-tight ${c.cor}`}>{fmt.numero(c.valor)}</span>
            {c.pct && <span className="text-[13px] text-slate-500">{c.pct}</span>}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function BarraDistribuicao({ lote }: { lote: Lote }) {
  const total = lote.total_registros
  if (total <= 0) return null
  const largura = (n: number) => `${(n / total) * 100}%`
  // Mesma codificação do resto do sistema: tinta = resultado normal, vermelho = problema
  const segmentos = [
    { cor: "bg-slate-700", rotulo: "Novos", valor: lote.total_importados },
    { cor: "bg-slate-400", rotulo: "Atualizados", valor: lote.total_atualizados },
    { cor: "bg-rose-600", rotulo: "Rejeitados", valor: lote.total_rejeitados },
  ]
  return (
    <div className="px-5 sm:px-6 py-4 border-t border-slate-200">
      <div className="flex items-center justify-between mb-2 text-[13px]">
        <p className="font-medium text-slate-700">Distribuição do lote</p>
        <span className="text-slate-500">{lote.progresso_percentual}% processado</span>
      </div>
      <div className="h-2.5 w-full flex rounded-full overflow-hidden bg-slate-100 gap-px">
        {segmentos.map((s) =>
          s.valor > 0 ? (
            <div key={s.rotulo} style={{ width: largura(s.valor) }} className={`${s.cor} transition-[width] duration-500`} title={`${s.rotulo}: ${fmt.numero(s.valor)}`} />
          ) : null,
        )}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3">
        {segmentos.map((s) => (
          <span key={s.rotulo} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className={`w-2.5 h-2.5 rounded-sm ${s.cor}`} aria-hidden="true" />
            {s.rotulo} <span className="font-medium text-slate-950">{fmt.numero(s.valor)}</span>
          </span>
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
          <Selecao
            value={campo}
            onChange={(e) => trocarCampo(e.target.value)}
            aria-label="Filtrar por campo"
            className="w-full sm:w-48"
          >
            <option value="">Todos os campos</option>
            {CAMPOS_FILTRO.map((c) => (
              <option key={c} value={c}>{NOME_CAMPO[c]}</option>
            ))}
          </Selecao>
          <button onClick={baixarCsv} disabled={baixando || (semErros && !campo)} className={BOTAO_SECUNDARIO}>
            {baixando ? <Spinner /> : <IconeDownload />}
            Exportar CSV de erros
          </button>
        </div>
      }
    >
      {erroDownload && (
        <div className="px-5 sm:px-6 pt-4">
          <AvisoErro mensagem={`Não foi possível baixar o CSV: ${erroDownload}`} />
        </div>
      )}

      {erros.erro && !erros.dados ? (
        <div className="p-5 sm:px-6">
          <AvisoErro mensagem={`Não foi possível carregar os erros: ${erros.erro}`} onTentarNovamente={erros.recarregar} />
        </div>
      ) : erros.carregando && !erros.dados ? (
        <EsqueletoTabela rotulo="Carregando problemas" />
      ) : lista.length === 0 ? (
        campo ? (
          <Vazio titulo={`Nenhum problema no campo ${NOME_CAMPO[campo] ?? campo}`} descricao="Escolha outro campo no filtro ou veja todos." />
        ) : processando ? (
          <Vazio titulo="Nenhum problema encontrado até agora" descricao="O lote ainda está sendo processado; esta lista se atualiza sozinha." />
        ) : (
          <div className="p-5 sm:px-6">
            <Aviso tipo="sucesso">Nenhuma linha rejeitada. Todos os registros foram importados.</Aviso>
          </div>
        )
      ) : (
        <div className={`overflow-x-auto transition-opacity ${erros.carregando ? "opacity-60" : ""}`}>
          <table className="w-full text-left text-[13px]">
            <thead className={THEAD}>
              <tr>
                {["Linha", "Campo", "Valor informado", "Problema"].map((h) => (
                  <th key={h} className={`${TH} whitespace-nowrap`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="text-slate-700">
              {lista.map((e, i) => {
                // Problemas da mesma linha ficam juntos: o número aparece só no primeiro
                const continuacao = i > 0 && lista[i - 1].numero_linha === e.numero_linha
                return (
                  <tr key={e.id} className={`align-top ${continuacao ? "" : "border-t border-slate-200 first:border-t-0"}`}>
                    <td className={`${TD} whitespace-nowrap font-medium text-slate-950`}>
                      {continuacao ? <span className="sr-only">Linha {e.numero_linha}</span> : `Linha ${e.numero_linha}`}
                    </td>
                    <td className={`${TD} whitespace-nowrap`}>
                      <span className="inline-flex items-center h-6 px-2 rounded-md bg-slate-100 text-xs font-medium text-slate-800" title={e.campo}>
                        {NOME_CAMPO[e.campo] ?? e.campo}
                      </span>
                    </td>
                    <td className={`${TD} font-mono text-xs text-slate-800 max-w-[260px] break-all`}>
                      {e.valor_informado || <span className="font-sans text-slate-400 italic">(vazio)</span>}
                    </td>
                    <td className={`${TD} text-rose-800 min-w-[240px]`}>{e.regra_violada}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {(pagina > 0 || temProxima) && (
        <div className="px-5 sm:px-6 py-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-[13px] text-slate-500">
          <span>
            Página {pagina + 1}: problemas{" "}
            <span className="font-medium text-slate-800">
              {fmt.numero(pagina * ERROS_POR_PAGINA + 1)}–{fmt.numero(pagina * ERROS_POR_PAGINA + lista.length)}
            </span>
          </span>
          <div className="flex gap-2">
            <button onClick={() => setPagina((p) => p - 1)} disabled={pagina === 0} className={BOTAO_SECUNDARIO_P}>
              Anterior
            </button>
            <button onClick={() => setPagina((p) => p + 1)} disabled={!temProxima} className={BOTAO_SECUNDARIO_P}>
              Próxima
            </button>
          </div>
        </div>
      )}
    </Painel>
  )
}
