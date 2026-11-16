import { useRef, useState } from "react"
import { CONTEUDO, PAGINA, SUPERFICIE } from "../components/estilos"
import { Aviso, BOTAO_PRIMARIO, BOTAO_SECUNDARIO, BOTAO_SECUNDARIO_P, CabecalhoPagina, IconeDownload, Spinner } from "../components/ui"
import { useApi } from "../hooks/useApi"
import { ApiError, apiFetch } from "../lib/api"
import * as fmt from "../lib/formatos"
import {
  COLUNAS_OBRIGATORIAS,
  COLUNAS_OPCIONAIS,
  EXTENSOES_ACEITAS,
  INTERVALO_POLLING_MS,
  MAXIMO_REGISTROS,
  NOME_CAMPO,
  TAMANHO_MAXIMO_MB,
  baixarPlanilhaModelo,
  emAndamento,
  validarArquivo,
} from "../lib/lotes"
import type { ErroLote, Lote, UploadLoteResponse } from "../lib/tipos"

interface ImportarLoteProps {
  /** Abre o relatório de validação do lote. */
  onVerRelatorio: (loteId: string) => void
}

export default function ImportarLote({ onVerRelatorio }: ImportarLoteProps) {
  const [arrastando, setArrastando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [nomeArquivo, setNomeArquivo] = useState("")
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)
  const [loteId, setLoteId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Polling de GET /lotes/{id} enquanto o lote estiver na fila ou processando.
  const consulta = useApi<Lote>(loteId ? `/lotes/${loteId}` : null, {
    intervaloMs: INTERVALO_POLLING_MS,
    pararQuando: (l) => l.id === loteId && !emAndamento(l),
  })
  // Ignora a resposta de um lote anterior enquanto a do novo não chega
  const lote = consulta.dados?.id === loteId ? consulta.dados : null

  const enviar = async (arquivo: File) => {
    setErroEnvio(null)
    const problema = validarArquivo(arquivo)
    if (problema) {
      setErroEnvio(problema)
      return
    }

    const form = new FormData()
    form.append("file", arquivo)
    setNomeArquivo(arquivo.name)
    setEnviando(true)
    try {
      const resposta = await apiFetch<UploadLoteResponse>("/lotes/upload", { method: "POST", body: form })
      setLoteId(resposta.lote_id)
    } catch (e) {
      setErroEnvio(e instanceof ApiError ? e.message : "Erro inesperado ao enviar o arquivo.")
    } finally {
      setEnviando(false)
      if (inputRef.current) inputRef.current.value = "" // permite reenviar o mesmo arquivo
    }
  }

  const recomecar = () => {
    setLoteId(null)
    setNomeArquivo("")
    setErroEnvio(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setArrastando(false)
    const arquivo = e.dataTransfer.files[0]
    if (arquivo) void enviar(arquivo)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0]
    if (arquivo) void enviar(arquivo)
  }

  // Etapa atual para o indicador: 0 enviando, 1 validando, 2 concluído (ou recusado)
  const etapa = enviando ? 0 : !loteId ? null : lote && !emAndamento(lote) ? 2 : 1

  return (
    <div className={PAGINA}>
      <div className={CONTEUDO}>
        <CabecalhoPagina
          titulo="Importar lote de devedores"
          descricao="Envie uma planilha CSV ou Excel. O processamento acontece em segundo plano e você acompanha o progresso aqui."
        />

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">

          {/* --- ÁREA PRINCIPAL --- */}
          <div className="xl:col-span-7 space-y-4">
            {etapa !== null && <Etapas atual={etapa} falhou={lote?.status === "erro"} />}

            {enviando ? (
              <CardEnviando nomeArquivo={nomeArquivo} />
            ) : loteId ? (
              <CardAcompanhamento
                loteId={loteId}
                nomeArquivo={nomeArquivo}
                lote={lote}
                erroConsulta={consulta.erro}
                onVerRelatorio={() => onVerRelatorio(loteId)}
                onNovo={recomecar}
              />
            ) : (
              <div
                role="button"
                tabIndex={0}
                aria-label="Selecionar arquivo para importar"
                aria-describedby={erroEnvio ? "erro-arquivo" : undefined}
                className={`rounded-xl flex flex-col items-center justify-center text-center transition-colors cursor-pointer px-6 py-12 border-2 border-dashed min-h-[320px] ${
                  arrastando
                    ? "border-tinta bg-slate-100"
                    : erroEnvio
                      ? "border-rose-300 bg-white hover:border-rose-400"
                      : "border-slate-300 bg-white hover:border-slate-500 hover:bg-slate-50"
                }`}
                onDragOver={(e) => { e.preventDefault(); setArrastando(true) }}
                onDragLeave={() => setArrastando(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click() } }}
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors ${
                    arrastando ? "bg-tinta text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
                <p className="font-medium text-slate-950 text-base">
                  {arrastando ? "Solte para enviar" : "Arraste a planilha para cá"}
                </p>
                <p className="text-sm text-slate-500 mt-1 mb-5">
                  ou <span className="font-medium text-slate-800 underline underline-offset-2">escolha um arquivo</span> no computador
                </p>
                <p className="text-xs text-slate-500">
                  CSV, XLSX ou XLS, até {fmt.numero(MAXIMO_REGISTROS)} registros e {TAMANHO_MAXIMO_MB} MB
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  accept={EXTENSOES_ACEITAS.join(",")}
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            )}

            {erroEnvio && (
              <div id="erro-arquivo">
                <Aviso tipo="erro">
                  <span className="font-medium">Arquivo recusado.</span> {erroEnvio}
                </Aviso>
              </div>
            )}
          </div>

          {/* --- COLUNAS E REGRAS --- */}
          <div className="xl:col-span-5 space-y-4">

            <section className={`${SUPERFICIE} p-5 sm:p-6`}>
              <div className="flex items-start justify-between gap-3 mb-4">
                <h2 className="text-base font-semibold text-slate-950">Colunas da planilha</h2>
                <button onClick={baixarPlanilhaModelo} className={BOTAO_SECUNDARIO_P}>
                  <IconeDownload />
                  Planilha modelo
                </button>
              </div>
              <p className="text-[13px] font-medium text-slate-700 mb-2">Obrigatórias</p>
              <dl className="space-y-2.5">
                {COLUNAS_OBRIGATORIAS.map((c) => (
                  <LinhaColuna key={c.coluna} coluna={c.coluna} descricao={c.descricao} />
                ))}
              </dl>
              <p className="text-[13px] font-medium text-slate-700 mt-5 mb-2">Opcionais</p>
              <dl className="space-y-2.5">
                {COLUNAS_OPCIONAIS.map((c) => (
                  <LinhaColuna key={c.coluna} coluna={c.coluna} descricao={c.descricao} />
                ))}
              </dl>
            </section>

            <section className={`${SUPERFICIE} p-5 sm:p-6`}>
              <h2 className="text-base font-semibold text-slate-950 mb-3">Regras de validação</h2>
              <ul className="space-y-2 list-disc pl-4 marker:text-slate-300">
                {[
                  "Uma linha com qualquer campo inválido é rejeitada inteira; as demais são importadas.",
                  "CPF/CNPJ precisa ter dígito verificador válido.",
                  "CPF/CNPJ repetido no mesmo arquivo: vale a primeira ocorrência, as outras são rejeitadas.",
                  "CPF/CNPJ que já está na base atualiza o devedor (exceto quitado, que é rejeitado).",
                  "Telefone e WhatsApp são opcionais, mas se preenchidos precisam de DDD + número.",
                  "Arquivo com coluna obrigatória faltando é recusado inteiro.",
                ].map((r, i) => (
                  <li key={i} className="text-[13px] text-slate-600 leading-relaxed pl-1">{r}</li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

const ETAPAS = ["Enviar arquivo", "Validar e importar", "Concluído"]

/** Indicador das três etapas de um lote. */
function Etapas({ atual, falhou }: { atual: number; falhou: boolean }) {
  return (
    <ol className="flex items-center gap-2 text-[13px]" aria-label="Etapas da importação">
      {ETAPAS.map((nome, i) => {
        const feita = i < atual || (i === atual && i === ETAPAS.length - 1 && !falhou)
        const erro = falhou && i === ETAPAS.length - 1
        const corrente = i === atual && !feita && !erro
        return (
          <li key={nome} className="flex items-center gap-2 min-w-0" aria-current={i === atual ? "step" : undefined}>
            {i > 0 && <span className={`w-6 sm:w-10 h-px ${i <= atual ? "bg-slate-500" : "bg-slate-200"}`} aria-hidden="true" />}
            <span
              className={`w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-medium ${
                erro ? "bg-rose-600 text-white" : feita ? "bg-tinta text-white" : corrente ? "border-2 border-tinta text-slate-950" : "border border-slate-300 text-slate-400"
              }`}
            >
              {erro ? "!" : feita ? "✓" : corrente ? <Spinner className="h-3 w-3" /> : i + 1}
            </span>
            <span className={`truncate ${erro ? "text-rose-800 font-medium" : i <= atual ? "text-slate-950" : "text-slate-400"}`}>
              {erro ? "Recusado" : nome}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function LinhaColuna({ coluna, descricao }: { coluna: string; descricao: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-3 items-baseline">
      <dt className="font-mono text-xs text-slate-950 truncate" title={coluna}>{coluna}</dt>
      <dd className="text-[13px] text-slate-600 leading-relaxed">{descricao}</dd>
    </div>
  )
}

const CARD = `${SUPERFICIE} px-6 py-10 flex flex-col items-center justify-center text-center min-h-[320px]`

function CardEnviando({ nomeArquivo }: { nomeArquivo: string }) {
  return (
    <div className={CARD} role="status">
      <Spinner className="h-6 w-6 text-slate-900 mb-4" />
      <p className="text-sm text-slate-500 mb-1">Enviando arquivo...</p>
      <p className="font-medium text-slate-950 text-base break-all">{nomeArquivo}</p>
    </div>
  )
}

function CardAcompanhamento({ loteId, nomeArquivo, lote, erroConsulta, onVerRelatorio, onNovo }: {
  loteId: string
  nomeArquivo: string
  lote: Lote | null
  erroConsulta: string | null
  onVerRelatorio: () => void
  onNovo: () => void
}) {
  if (lote?.status === "concluido") {
    return <CardConcluido lote={lote} onVerRelatorio={onVerRelatorio} onNovo={onNovo} />
  }
  if (lote?.status === "erro") {
    return <CardErro loteId={loteId} lote={lote} onVerRelatorio={onVerRelatorio} onNovo={onNovo} />
  }

  // Na fila ou processando (ou aguardando a primeira resposta do polling)
  const progresso = lote?.progresso_percentual ?? 0
  const status = lote ? fmt.STATUS_LOTE[lote.status].texto : "Na fila"
  return (
    <div className={CARD} role="status">
      <p className="text-sm text-slate-500 mb-1">{status}...</p>
      <p className="font-medium text-slate-950 text-base mb-6 break-all">{lote?.nome_arquivo ?? nomeArquivo}</p>

      <div className="w-full max-w-sm">
        <div className="flex justify-between text-[13px] mb-1.5">
          <span className="text-slate-500">Validação e importação</span>
          <span className="font-medium text-slate-950">{progresso}%</span>
        </div>
        <div
          className="h-2 bg-slate-100 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={progresso}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progresso do lote"
        >
          <div className="h-full bg-tinta rounded-full transition-[width] duration-500" style={{ width: `${progresso}%` }} />
        </div>
      </div>

      {lote && lote.total_registros > 0 && (
        <p className="text-[13px] text-slate-500 mt-4">
          {fmt.numero(lote.total_importados + lote.total_atualizados + lote.total_rejeitados)} de{" "}
          {fmt.numero(lote.total_registros)} linhas analisadas
        </p>
      )}
      {erroConsulta && (
        <p className="text-[13px] text-amber-800 mt-4">
          Não foi possível consultar o progresso ({erroConsulta}). Tentando de novo...
        </p>
      )}
      <p className="text-xs text-slate-500 mt-6 max-w-sm">
        Pode sair desta tela: o processamento continua e o resultado fica no relatório de validação.
      </p>
    </div>
  )
}

function Numero({ rotulo, valor, cor }: { rotulo: string; valor: number; cor: string }) {
  return (
    <div className="px-4 py-3 text-left">
      <dt className="text-[13px] text-slate-500">{rotulo}</dt>
      <dd className={`mt-0.5 text-2xl font-semibold tracking-tight ${cor}`}>{fmt.numero(valor)}</dd>
    </div>
  )
}

function CardConcluido({ lote, onVerRelatorio, onNovo }: { lote: Lote; onVerRelatorio: () => void; onNovo: () => void }) {
  const comRejeicao = lote.total_rejeitados > 0
  return (
    <div className={CARD}>
      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
          comRejeicao ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
        }`}
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
          {comRejeicao
            ? <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v5m0 4h.01" />
            : <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />}
        </svg>
      </div>

      <p className="font-semibold text-slate-950 text-lg">
        {comRejeicao ? "Arquivo processado com rejeições" : "Arquivo processado"}
      </p>
      <p className="text-sm text-slate-500 mt-1 mb-6 break-all">
        {lote.nome_arquivo}: {fmt.numero(lote.total_registros)} registros analisados
      </p>

      <dl className="grid grid-cols-3 divide-x divide-slate-200 w-full max-w-md mb-8 rounded-lg border border-slate-200">
        <Numero rotulo="Novos" valor={lote.total_importados} cor="text-slate-950" />
        <Numero rotulo="Atualizados" valor={lote.total_atualizados} cor="text-slate-950" />
        <Numero rotulo="Rejeitados" valor={lote.total_rejeitados} cor={comRejeicao ? "text-rose-700" : "text-slate-400"} />
      </dl>

      <div className="flex flex-col sm:flex-row gap-2 w-full max-w-sm">
        <button onClick={onVerRelatorio} className={`flex-1 ${comRejeicao ? BOTAO_PRIMARIO : BOTAO_SECUNDARIO}`}>
          {comRejeicao ? "Ver linhas rejeitadas" : "Ver relatório"}
        </button>
        <button onClick={onNovo} className={`flex-1 ${comRejeicao ? BOTAO_SECUNDARIO : BOTAO_PRIMARIO}`}>
          Importar outro arquivo
        </button>
      </div>
    </div>
  )
}

/** Lote com status "erro": falha estrutural (cabeçalho, limite de registros, arquivo ilegível). */
function CardErro({ loteId, lote, onVerRelatorio, onNovo }: {
  loteId: string
  lote: Lote
  onVerRelatorio: () => void
  onNovo: () => void
}) {
  const { dados: erros } = useApi<ErroLote[]>(`/lotes/${loteId}/erros?limit=5`)
  return (
    <div className={CARD}>
      <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-700 flex items-center justify-center mb-4">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <p className="font-semibold text-slate-950 text-lg">O arquivo não pôde ser importado</p>
      <p className="text-sm text-slate-500 mt-1 mb-5 break-all">{lote.nome_arquivo}</p>

      {erros && erros.length > 0 && (
        <ul className="mb-8 w-full max-w-md text-left rounded-lg border border-rose-200 bg-rose-50 divide-y divide-rose-100">
          {erros.map((e) => (
            <li key={e.id} className="px-4 py-2.5 text-[13px] text-rose-800">
              <span className="font-medium">{NOME_CAMPO[e.campo] ?? e.campo}:</span> {e.regra_violada}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col sm:flex-row gap-2 w-full max-w-sm">
        <button onClick={onNovo} className={`flex-1 ${BOTAO_PRIMARIO}`}>
          Enviar outro arquivo
        </button>
        <button onClick={onVerRelatorio} className={`flex-1 ${BOTAO_SECUNDARIO}`}>
          Ver relatório
        </button>
      </div>
    </div>
  )
}
