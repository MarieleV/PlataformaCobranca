import { useRef, useState } from "react"
import { AvisoErro, IconeDownload, Spinner } from "../components/ui"
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

  return (
    <div className="p-4 md:p-6 xl:p-8 overflow-y-auto h-full bg-slate-50 font-sans">

      {/* --- HEADER --- */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Importar Lote de Devedores
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Envie uma planilha CSV ou Excel. O processamento acontece em segundo plano e você acompanha o progresso aqui.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* --- ÁREA PRINCIPAL --- */}
        <div className="lg:col-span-7 space-y-4">
          {erroEnvio && <AvisoErro mensagem={erroEnvio} />}

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
              className={`rounded-2xl flex flex-col items-center justify-center text-center transition-all cursor-pointer p-10 bg-white border-2 border-dashed shadow-sm shadow-slate-200/50 min-h-[320px] outline-none focus-visible:ring-4 focus-visible:ring-black/10 ${
                arrastando
                  ? "border-blue-600 bg-blue-50/40"
                  : "border-slate-300 hover:border-slate-400"
              }`}
              onDragOver={(e) => { e.preventDefault(); setArrastando(true) }}
              onDragLeave={() => setArrastando(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click() } }}
            >
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 shadow-sm shadow-slate-200/50">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <p className="font-bold text-slate-900 text-base mb-1">
                Arraste o arquivo aqui
              </p>
              <p className="text-sm text-slate-500 mb-6">
                ou clique para selecionar do computador
              </p>
              <span className="font-mono text-xs font-semibold text-slate-400 bg-slate-100 px-3 py-1 rounded-md">
                CSV · XLSX · XLS · até {fmt.numero(MAXIMO_REGISTROS)} registros · {TAMANHO_MAXIMO_MB} MB
              </span>
              <input
                ref={inputRef}
                type="file"
                accept={EXTENSOES_ACEITAS.join(",")}
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          )}
        </div>

        {/* --- COLUNAS E REGRAS --- */}
        <div className="lg:col-span-5 space-y-6">

          <div className="rounded-2xl bg-white p-6 border border-slate-200/60 shadow-sm shadow-slate-200/50">
            <h2 className="font-bold text-slate-900 text-base mb-4">
              Colunas da planilha
            </h2>
            <div className="space-y-3">
              {COLUNAS_OBRIGATORIAS.map((c) => (
                <LinhaColuna key={c.coluna} coluna={c.coluna} descricao={c.descricao} />
              ))}
            </div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-5 mb-3">Opcionais</p>
            <div className="space-y-3">
              {COLUNAS_OPCIONAIS.map((c) => (
                <LinhaColuna key={c.coluna} coluna={c.coluna} descricao={c.descricao} opcional />
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 border border-slate-200/60 shadow-sm shadow-slate-200/50">
            <h2 className="font-bold text-slate-900 text-base mb-4">
              Regras de validação
            </h2>
            <div className="space-y-2.5">
              {[
                "Uma linha com qualquer campo inválido é rejeitada inteira; as demais são importadas.",
                "CPF/CNPJ precisa ter dígito verificador válido.",
                "CPF/CNPJ repetido no mesmo arquivo: vale a primeira ocorrência, as outras são rejeitadas.",
                "CPF/CNPJ que já está na base atualiza o devedor (exceto quitado, que é rejeitado).",
                "Telefone e WhatsApp são opcionais, mas se preenchidos precisam de DDD + número.",
                "Arquivo com coluna obrigatória faltando é recusado inteiro.",
              ].map((r, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="text-amber-500 font-bold text-sm flex-shrink-0">·</span>
                  <p className="text-xs text-slate-600 leading-relaxed">{r}</p>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={baixarPlanilhaModelo}
            className="w-full py-3.5 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold font-mono transition-all shadow-sm shadow-slate-200/50 flex items-center justify-center gap-2"
          >
            <span className="text-slate-500"><IconeDownload /></span>
            Baixar planilha modelo (.csv)
          </button>

        </div>
      </div>
    </div>
  )
}

function LinhaColuna({ coluna, descricao, opcional = false }: { coluna: string; descricao: string; opcional?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={`font-mono text-xs font-semibold px-2 py-0.5 rounded border flex-shrink-0 mt-0.5 ${
          opcional ? "text-slate-500 bg-slate-50 border-slate-200" : "text-blue-600 bg-blue-50 border-blue-100"
        }`}
      >
        {coluna}
      </span>
      <p className="text-xs text-slate-600 leading-relaxed">{descricao}</p>
    </div>
  )
}

const CARD = "rounded-2xl bg-white p-8 flex flex-col items-center justify-center text-center border shadow-sm shadow-slate-200/50 min-h-[320px]"

function CardEnviando({ nomeArquivo }: { nomeArquivo: string }) {
  return (
    <div className={`${CARD} border-slate-200/60`}>
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">
        <Spinner className="h-4 w-4 text-blue-600" />
        Enviando arquivo...
      </div>
      <p className="font-bold text-slate-900 text-base break-all">{nomeArquivo}</p>
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
    <div className={`${CARD} border-slate-200/60`}>
      <div className="flex items-center gap-2 font-mono text-xs font-semibold text-slate-500 mb-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
        </span>
        {status}...
      </div>
      <p className="font-bold text-slate-900 text-base mb-6 break-all">{lote?.nome_arquivo ?? nomeArquivo}</p>

      <div className="w-full max-w-sm space-y-2">
        <div className="flex justify-between text-xs font-mono">
          <span className="font-semibold text-slate-500">Validação e importação</span>
          <span className="font-bold text-blue-600">{progresso}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
          <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${progresso}%` }} />
        </div>
      </div>

      {lote && lote.total_registros > 0 && (
        <p className="font-mono text-xs text-slate-500 mt-6">
          {fmt.numero(lote.total_importados + lote.total_atualizados + lote.total_rejeitados)} de{" "}
          {fmt.numero(lote.total_registros)} linhas analisadas
        </p>
      )}
      {erroConsulta && (
        <p className="text-xs font-medium text-amber-600 mt-4">
          Não foi possível consultar o progresso ({erroConsulta}). Tentando de novo...
        </p>
      )}
      <p className="text-xs text-slate-400 mt-6 max-w-sm">
        Pode sair desta tela: o processamento continua e o resultado fica no Relatório.
      </p>
    </div>
  )
}

function Numero({ rotulo, valor, cor }: { rotulo: string; valor: number; cor: string }) {
  return (
    <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-100">
      <p className={`text-xl font-bold ${cor}`}>{fmt.numero(valor)}</p>
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{rotulo}</p>
    </div>
  )
}

function CardConcluido({ lote, onVerRelatorio, onNovo }: { lote: Lote; onVerRelatorio: () => void; onNovo: () => void }) {
  const comRejeicao = lote.total_rejeitados > 0
  return (
    <div className={`${CARD} ${comRejeicao ? "border-amber-200" : "border-emerald-200"}`}>
      <div
        className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 shadow-sm shadow-slate-200/50 ${
          comRejeicao ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
        }`}
      >
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <p className="font-bold text-slate-900 text-xl mb-1">
        {comRejeicao ? "Arquivo processado com rejeições" : "Arquivo processado!"}
      </p>
      <p className="text-sm text-slate-500 mb-6 font-medium break-all">
        {lote.nome_arquivo} · <span className="font-mono text-slate-700 font-bold">{fmt.numero(lote.total_registros)} registros analisados</span>
      </p>

      <div className="grid grid-cols-3 gap-3 w-full max-w-md mb-8">
        <Numero rotulo="Novos" valor={lote.total_importados} cor="text-emerald-600" />
        <Numero rotulo="Atualizados" valor={lote.total_atualizados} cor="text-blue-600" />
        <Numero rotulo="Rejeitados" valor={lote.total_rejeitados} cor={comRejeicao ? "text-rose-600" : "text-slate-400"} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
        <button
          onClick={onVerRelatorio}
          className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all ${
            comRejeicao
              ? "bg-black hover:bg-slate-900 text-white shadow-sm shadow-black/10"
              : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm shadow-slate-200/50"
          }`}
        >
          {comRejeicao ? "Ver linhas rejeitadas" : "Ver relatório"}
        </button>
        <button
          onClick={onNovo}
          className="px-5 py-3 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-sm transition-all shadow-sm shadow-slate-200/50"
        >
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
    <div className={`${CARD} border-rose-200`}>
      <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <p className="font-bold text-slate-900 text-xl mb-1">O arquivo não pôde ser importado</p>
      <p className="text-sm text-slate-500 mb-4 font-medium break-all">{lote.nome_arquivo}</p>

      {erros && erros.length > 0 && (
        <ul className="mb-8 space-y-1.5 text-sm text-rose-700 font-medium">
          {erros.map((e) => (
            <li key={e.id}>
              {NOME_CAMPO[e.campo] ?? e.campo}: {e.regra_violada}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
        <button
          onClick={onNovo}
          className="flex-1 py-3 rounded-xl bg-black hover:bg-slate-900 text-white font-semibold text-sm transition-all shadow-sm shadow-black/10"
        >
          Enviar outro arquivo
        </button>
        <button
          onClick={onVerRelatorio}
          className="px-5 py-3 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-sm transition-all shadow-sm shadow-slate-200/50"
        >
          Ver relatório
        </button>
      </div>
    </div>
  )
}
