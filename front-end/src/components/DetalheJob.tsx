// Painel lateral de um job da régua: progresso e o resultado de cada
// comunicação (status, tentativas, próximo reenvio e erro — RF07).

import { useState } from "react"
import { useApi } from "../hooks/useApi"
import * as fmt from "../lib/formatos"
import { jobEmAndamento } from "../lib/jobs"
import type { ComunicacaoDoJob, Job, Pagina, StatusComunicacao } from "../lib/tipos"
import { useFecharComEsc } from "../hooks/useFecharComEsc"
import { AvisoErro, Badge, Spinner } from "./ui"

const POR_PAGINA = 50
const ATUALIZAR_MS = 15_000
const MAXIMO_TENTATIVAS = 4 // RN07

const FILTROS: { valor: StatusComunicacao | ""; texto: string }[] = [
  { valor: "", texto: "Todas" },
  { valor: "pendente", texto: "Pendentes" },
  { valor: "enviado", texto: "Enviadas" },
  { valor: "falha", texto: "Falhas" },
  { valor: "bounce", texto: "Bounces" },
]

interface DetalheJobProps {
  jobId: string
  onFechar: () => void
}

export default function DetalheJob({ jobId, onFechar }: DetalheJobProps) {
  useFecharComEsc(onFechar)
  const consulta = useApi<Job>(`/jobs/${jobId}`, {
    intervaloMs: ATUALIZAR_MS,
    pararQuando: (j) => !jobEmAndamento(j),
  })
  const job = consulta.dados

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onFechar} />
      <aside role="dialog" aria-modal="true" aria-label="Detalhe do job" className="relative w-full max-w-3xl h-full bg-slate-50 shadow-2xl flex flex-col">
        {/* Cabeçalho */}
        <div className="px-6 py-5 bg-white border-b border-slate-200 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Job da régua</p>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight truncate">{job?.regra_nome ?? "Carregando..."}</h2>
            {job && (
              <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-500">
                <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: fmt.COR_CANAL[job.canal] }} />
                  {fmt.NOME_CANAL[job.canal]}
                </span>
                <span>· Dia de referência {fmt.data(job.dia_referencia)}</span>
                <Badge texto={fmt.STATUS_JOB[job.status].texto} classe={fmt.STATUS_JOB[job.status].classe} />
              </div>
            )}
          </div>
          <button onClick={onFechar} aria-label="Fechar" className="p-2 -mr-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {consulta.erro && !job ? (
            <AvisoErro mensagem={`Não foi possível carregar o job: ${consulta.erro}`} onTentarNovamente={consulta.recarregar} />
          ) : !job ? (
            <div className="flex items-center gap-2 text-sm text-slate-500"><Spinner /> Carregando...</div>
          ) : (
            <>
              <Resumo job={job} />
              <Comunicacoes job={job} />
            </>
          )}
        </div>
      </aside>
    </div>
  )
}

function Resumo({ job }: { job: Job }) {
  const pct = (n: number) => (job.total_alvos > 0 ? `${(n / job.total_alvos) * 100}%` : "0%")
  const numeros = [
    { rotulo: "Alvos", valor: job.total_alvos, cor: "text-slate-900" },
    { rotulo: "Sucesso", valor: job.total_sucesso, cor: "text-emerald-600" },
    { rotulo: "Falhas", valor: job.total_falhas, cor: job.total_falhas > 0 ? "text-rose-600" : "text-slate-400" },
    { rotulo: "Pendentes", valor: job.pendentes, cor: job.pendentes > 0 ? "text-amber-600" : "text-slate-400" },
  ]
  return (
    <section className="bg-white rounded-2xl border border-slate-200/60 shadow-sm shadow-slate-200/50 p-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {numeros.map((n) => (
          <div key={n.rotulo} className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-100">
            <p className={`text-2xl font-bold ${n.cor}`}>{fmt.numero(n.valor)}</p>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{n.rotulo}</p>
          </div>
        ))}
      </div>

      <div className="flex justify-between text-xs font-mono mb-1.5">
        <span className="font-semibold text-slate-500">Progresso</span>
        <span className="font-bold text-slate-700">{job.progresso_percentual.toLocaleString("pt-BR")}%</span>
      </div>
      <div className="h-2.5 w-full flex rounded-full overflow-hidden bg-slate-100 gap-0.5">
        <div className="bg-emerald-500 transition-all duration-500" style={{ width: pct(job.total_sucesso) }} />
        <div className="bg-rose-500 transition-all duration-500" style={{ width: pct(job.total_falhas) }} />
      </div>

      <dl className="grid grid-cols-2 gap-4 mt-5 text-xs">
        <div><dt className="text-slate-400 font-semibold uppercase tracking-wide">Início</dt><dd className="font-mono text-slate-700 mt-0.5">{fmt.dataHora(job.inicio_em)}</dd></div>
        <div><dt className="text-slate-400 font-semibold uppercase tracking-wide">Fim</dt><dd className="font-mono text-slate-700 mt-0.5">{job.fim_em ? fmt.dataHora(job.fim_em) : jobEmAndamento(job) ? "em andamento" : "—"}</dd></div>
      </dl>
      {job.pendentes > 0 && jobEmAndamento(job) && (
        <p className="text-xs text-slate-500 mt-4">
          O job termina quando as pendentes se resolvem: falhas temporárias são reenviadas a cada 30 minutos, até {MAXIMO_TENTATIVAS} tentativas,
          sempre dentro da janela de disparo. Esta tela atualiza sozinha.
        </p>
      )}
    </section>
  )
}

function Comunicacoes({ job }: { job: Job }) {
  const [filtro, setFiltro] = useState<StatusComunicacao | "">("")
  const [pagina, setPagina] = useState(0)
  const query = new URLSearchParams({ skip: String(pagina * POR_PAGINA), limit: String(POR_PAGINA) })
  if (filtro) query.set("status", filtro)

  const consulta = useApi<Pagina<ComunicacaoDoJob>>(`/jobs/${job.id}/comunicacoes?${query}`, {
    intervaloMs: jobEmAndamento(job) ? ATUALIZAR_MS : undefined,
  })
  const dados = consulta.dados
  const totalPaginas = dados ? Math.max(1, Math.ceil(dados.total / POR_PAGINA)) : 1

  return (
    <section className="bg-white rounded-2xl border border-slate-200/60 shadow-sm shadow-slate-200/50 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-900">
          Comunicações {dados && <span className="font-mono text-slate-400">({fmt.numero(dados.total)})</span>}
        </h3>
        <div className="inline-flex flex-wrap p-1 rounded-lg bg-slate-100/80 border border-slate-200" role="group" aria-label="Filtrar por status">
          {FILTROS.map((f) => (
            <button
              key={f.valor || "todas"}
              onClick={() => { setFiltro(f.valor); setPagina(0) }}
              aria-pressed={filtro === f.valor}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                filtro === f.valor ? "bg-white text-slate-900 shadow-sm border border-slate-200/60" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {f.texto}
            </button>
          ))}
        </div>
      </div>

      {consulta.erro && !dados ? (
        <div className="p-5"><AvisoErro mensagem={`Não foi possível carregar as comunicações: ${consulta.erro}`} onTentarNovamente={consulta.recarregar} /></div>
      ) : !dados ? (
        <div className="px-5 py-10 flex justify-center gap-2 text-sm text-slate-500"><Spinner /> Carregando...</div>
      ) : dados.itens.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-400">
          {filtro ? "Nenhuma comunicação com este status." : "Este job ainda não gerou comunicações."}
        </p>
      ) : (
        <div className={`overflow-x-auto transition-opacity ${consulta.carregando ? "opacity-60" : ""}`}>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/50">
              <tr>
                {["Devedor", "Status", "Tentativas", "Enviado / próximo reenvio", "Erro"].map((h) => (
                  <th key={h} className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dados.itens.map((c) => {
                const status = fmt.STATUS_COMUNICACAO[c.status]
                const reenvio = c.status === "falha" && c.proxima_tentativa_em
                return (
                  <tr key={c.id} className="hover:bg-slate-50/80 align-top">
                    <td className="px-5 py-3 font-semibold text-slate-800 text-[13px] max-w-[200px] truncate" title={c.devedor_nome}>{c.devedor_nome}</td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <Badge texto={reenvio ? "Falha · vai reenviar" : c.status === "falha" ? "Falha definitiva" : status.texto} classe={status.classe} />
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">{c.tentativas} de {MAXIMO_TENTATIVAS}</td>
                    <td className="px-5 py-3 font-mono text-xs whitespace-nowrap">
                      {c.enviado_em ? (
                        <span className="text-slate-600">{fmt.dataHora(c.enviado_em)}</span>
                      ) : reenvio ? (
                        <span className="text-amber-600">reenvio às {fmt.dataHora(c.proxima_tentativa_em)}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-rose-600 min-w-[180px]">
                      {c.codigo_erro && <span className="font-mono">[{c.codigo_erro}] </span>}
                      {c.mensagem_erro}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {dados && dados.total > POR_PAGINA && (
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>Página {pagina + 1} de {totalPaginas}</span>
          <div className="flex gap-2">
            <button onClick={() => setPagina((p) => p - 1)} disabled={pagina === 0} className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">← Anterior</button>
            <button onClick={() => setPagina((p) => p + 1)} disabled={pagina + 1 >= totalPaginas} className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">Próxima →</button>
          </div>
        </div>
      )}
    </section>
  )
}
