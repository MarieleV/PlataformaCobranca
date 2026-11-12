import { useEffect, useState } from "react"
import DetalheJob, { jobEmAndamento } from "../components/DetalheJob"
import { AvisoErro, Badge, Painel, Spinner } from "../components/ui"
import { useApi } from "../hooks/useApi"
import { NOME_DEPENDENCIA, useSaude } from "../hooks/useSaude"
import * as fmt from "../lib/formatos"
import { estadoJanela } from "../lib/janela"
import type { Job, Pagina, Regra, Saude, StatusJob } from "../lib/tipos"

const POR_PAGINA = 20
const ATUALIZAR_MS = 15_000
const STATUS: StatusJob[] = ["agendado", "executando", "concluido", "falhou"]

interface MonitoramentoProps {
  /** Job aberto ao chegar na tela (ex.: clicado no Dashboard). */
  jobId: string | null
  onAbrirJob: (jobId: string | null) => void
}

export default function Monitoramento({ jobId, onAbrirJob }: MonitoramentoProps) {
  const [status, setStatus] = useState<StatusJob | "">("")
  const [regraId, setRegraId] = useState("")
  const [pagina, setPagina] = useState(0)

  const query = new URLSearchParams({ skip: String(pagina * POR_PAGINA), limit: String(POR_PAGINA) })
  if (status) query.set("status", status)
  if (regraId) query.set("regra_id", regraId)

  // Atualiza sozinho enquanto houver job em andamento na página
  const jobs = useApi<Pagina<Job>>(`/jobs/?${query}`, {
    intervaloMs: ATUALIZAR_MS,
    pararQuando: (p) => !p.itens.some(jobEmAndamento),
  })
  const regras = useApi<Regra[]>("/regras/")
  const dados = jobs.dados
  const totalPaginas = dados ? Math.max(1, Math.ceil(dados.total / POR_PAGINA)) : 1
  const filtrando = Boolean(status || regraId)

  return (
    <div className="p-4 md:p-6 xl:p-8 overflow-y-auto h-full bg-slate-50 font-sans space-y-6">

      {/* --- HEADER --- */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Monitoramento
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Saúde dos serviços, janela de disparo e execução dos jobs da régua, com o resultado de cada comunicação.
        </p>
      </div>

      {/* --- SERVIÇOS E JANELA --- */}
      <Servicos />

      {/* --- JOBS --- */}
      <Painel
        titulo={<>Jobs da régua {dados && <span className="font-mono text-slate-400">({fmt.numero(dados.total)})</span>}</>}
        subtitulo="Um job por regra e dia de referência. Clique para ver as comunicações."
        acao={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value as StatusJob | ""); setPagina(0) }}
              aria-label="Filtrar por status"
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 outline-none focus:border-black"
            >
              <option value="">Todos os status</option>
              {STATUS.map((s) => <option key={s} value={s}>{fmt.STATUS_JOB[s].texto}</option>)}
            </select>
            <select
              value={regraId}
              onChange={(e) => { setRegraId(e.target.value); setPagina(0) }}
              aria-label="Filtrar por regra"
              className="max-w-[220px] px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 outline-none focus:border-black"
            >
              <option value="">Todas as regras</option>
              {regras.dados?.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
            <button
              onClick={jobs.recarregar}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Atualizar
            </button>
          </div>
        }
      >
        {jobs.erro && !dados ? (
          <div className="p-6"><AvisoErro mensagem={`Não foi possível carregar os jobs: ${jobs.erro}`} onTentarNovamente={jobs.recarregar} /></div>
        ) : !dados ? (
          <div className="px-6 py-10 flex justify-center gap-2 text-sm text-slate-500"><Spinner /> Carregando jobs...</div>
        ) : dados.itens.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm font-medium text-slate-400">
            {filtrando ? "Nenhum job com os filtros aplicados." : "Nenhum job executado ainda. Ative uma regra na Régua de Cobrança."}
          </p>
        ) : (
          <div className={`overflow-x-auto transition-opacity ${jobs.carregando ? "opacity-60" : ""}`}>
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50/50">
                <tr>
                  {["Regra", "Canal", "Dia de referência", "Status", "Progresso", "Sucesso", "Falhas", "Pendentes", "Início"].map((h) => (
                    <th key={h} className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dados.itens.map((job) => (
                  <LinhaJob key={job.id} job={job} onAbrir={() => onAbrirJob(job.id)} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {dados && dados.total > POR_PAGINA && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Página {pagina + 1} de {totalPaginas}</span>
            <div className="flex gap-2">
              <button onClick={() => setPagina((p) => p - 1)} disabled={pagina === 0} className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">← Anterior</button>
              <button onClick={() => setPagina((p) => p + 1)} disabled={pagina + 1 >= totalPaginas} className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">Próxima →</button>
            </div>
          </div>
        )}
      </Painel>

      {dados?.itens.some(jobEmAndamento) && jobs.atualizadoEm && (
        <p className="text-center text-[11px] font-mono text-slate-400">
          Há jobs em andamento · atualizado às {fmt.hora(jobs.atualizadoEm)} · atualiza sozinho a cada 15 s
        </p>
      )}

      {jobId && <DetalheJob jobId={jobId} onFechar={() => { onAbrirJob(null); jobs.recarregar() }} />}
    </div>
  )
}

function LinhaJob({ job, onAbrir }: { job: Job; onAbrir: () => void }) {
  const status = fmt.STATUS_JOB[job.status]
  const largura = (n: number) => (job.total_alvos > 0 ? `${(n / job.total_alvos) * 100}%` : "0%")
  return (
    <tr
      onClick={onAbrir}
      onKeyDown={(e) => { if (e.key === "Enter") onAbrir() }}
      tabIndex={0}
      className="hover:bg-slate-50/80 transition-colors cursor-pointer outline-none focus-visible:bg-slate-100"
    >
      <td className="px-6 py-4 font-medium text-slate-800 max-w-[240px] truncate" title={job.regra_nome}>{job.regra_nome}</td>
      <td className="px-6 py-4">
        <span className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: fmt.COR_CANAL[job.canal] }} />
          {fmt.NOME_CANAL[job.canal]}
        </span>
      </td>
      <td className="px-6 py-4 font-mono text-xs text-slate-500">{fmt.data(job.dia_referencia)}</td>
      <td className="px-6 py-4"><Badge texto={status.texto} classe={status.classe} /></td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 flex rounded-full overflow-hidden bg-slate-100">
            <div className="bg-emerald-500" style={{ width: largura(job.total_sucesso) }} />
            <div className="bg-rose-500" style={{ width: largura(job.total_falhas) }} />
          </div>
          <span className="font-mono text-xs text-slate-500">{job.progresso_percentual.toLocaleString("pt-BR")}%</span>
        </div>
      </td>
      <td className="px-6 py-4 font-mono text-xs text-emerald-600 font-semibold">{fmt.numero(job.total_sucesso)}</td>
      <td className={`px-6 py-4 font-mono text-xs ${job.total_falhas > 0 ? "text-rose-600 font-semibold" : "text-slate-400"}`}>{fmt.numero(job.total_falhas)}</td>
      <td className={`px-6 py-4 font-mono text-xs ${job.pendentes > 0 ? "text-amber-600 font-semibold" : "text-slate-400"}`}>{fmt.numero(job.pendentes)}</td>
      <td className="px-6 py-4 font-mono text-xs text-slate-500">{fmt.dataHora(job.inicio_em ?? job.criado_em)}</td>
    </tr>
  )
}

// --- Serviços e janela ---------------------------------------------------------

function Servicos() {
  const { saude, verificadoEm } = useSaude(30_000)
  const [janela, setJanela] = useState(() => estadoJanela())

  // Recalcula a janela a cada 30 s (muda com o relógio, não com a API)
  useEffect(() => {
    const id = window.setInterval(() => setJanela(estadoJanela()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const dependencias = Object.keys(NOME_DEPENDENCIA) as (keyof Saude["dependencias"])[]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {dependencias.map((d) => {
        const ok = saude ? saude.dependencias[d] : null
        return (
          <CardServico
            key={d}
            titulo={NOME_DEPENDENCIA[d]}
            estado={saude === undefined ? "verificando" : ok ? "ok" : "erro"}
            texto={saude === undefined ? "Verificando..." : saude === null ? "API sem resposta" : ok ? "Operacional" : "Fora do ar"}
            rodape={verificadoEm ? `Verificado às ${fmt.hora(verificadoEm)}` : ""}
          />
        )
      })}
      <CardServico
        titulo="Janela de disparo"
        estado={janela.aberta ? "ok" : "neutro"}
        texto={janela.aberta ? "Aberta" : "Fechada"}
        rodape={`${janela.detalhe} · seg. a sex., 8h às 19h55, exceto feriados`}
      />
    </div>
  )
}

const ESTILO_ESTADO = {
  ok: { ponto: "bg-emerald-500", texto: "text-emerald-700" },
  erro: { ponto: "bg-rose-500", texto: "text-rose-700" },
  neutro: { ponto: "bg-slate-400", texto: "text-slate-600" },
  verificando: { ponto: "bg-slate-300 animate-pulse", texto: "text-slate-400" },
}

function CardServico({ titulo, estado, texto, rodape }: {
  titulo: string
  estado: keyof typeof ESTILO_ESTADO
  texto: string
  rodape: string
}) {
  const estilo = ESTILO_ESTADO[estado]
  return (
    <div className={`p-5 rounded-2xl bg-white border shadow-sm shadow-slate-200/50 ${estado === "erro" ? "border-rose-200" : "border-slate-200/60"}`}>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{titulo}</p>
      <p className={`flex items-center gap-2 text-lg font-bold ${estilo.texto}`}>
        <span className={`w-2.5 h-2.5 rounded-full ${estilo.ponto}`} />
        {texto}
      </p>
      {rodape && <p className="text-[11px] text-slate-400 mt-2">{rodape}</p>}
    </div>
  )
}
