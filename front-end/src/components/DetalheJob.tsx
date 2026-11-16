// Painel lateral de um job da régua: progresso e o resultado de cada
// comunicação (status, tentativas, próximo reenvio e erro — RF07).

import { useState } from "react"
import { useApi } from "../hooks/useApi"
import * as fmt from "../lib/formatos"
import { jobEmAndamento } from "../lib/jobs"
import type { ComunicacaoDoJob, Job, Pagina, StatusComunicacao } from "../lib/tipos"
import { useFecharComEsc } from "../hooks/useFecharComEsc"
import { TBODY, TD, TH, THEAD } from "./estilos"
import { AvisoErro, Badge, Contagem, EsqueletoTabela, IconeFechar, Paginacao, Spinner, Vazio } from "./ui"

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
      <div className="absolute inset-0 bg-slate-950/40 animar-esmaecer" onClick={onFechar} />
      <aside role="dialog" aria-modal="true" aria-label="Detalhe do job" className="relative w-full max-w-3xl h-full bg-papel shadow-2xl shadow-slate-950/20 flex flex-col animar-deslizar">
        {/* Cabeçalho */}
        <div className="px-6 py-5 bg-white border-b border-slate-200 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[13px] text-slate-500 mb-0.5">Job da régua</p>
            <h2 className="text-lg font-semibold text-slate-950 tracking-tight truncate">{job?.regra_nome ?? "Carregando..."}</h2>
            {job && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-2 text-[13px] text-slate-500">
                <span className="font-medium text-slate-800">{fmt.NOME_CANAL[job.canal]}</span>
                <span>Dia de referência {fmt.data(job.dia_referencia)}</span>
                <Badge texto={fmt.STATUS_JOB[job.status].texto} classe={fmt.STATUS_JOB[job.status].classe} />
              </div>
            )}
          </div>
          <button onClick={onFechar} aria-label="Fechar" className="w-8 h-8 -mr-2 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-950 hover:bg-slate-100 transition-colors">
            <IconeFechar />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {consulta.erro && !job ? (
            <AvisoErro mensagem={`Não foi possível carregar o job: ${consulta.erro}`} onTentarNovamente={consulta.recarregar} />
          ) : !job ? (
            <div className="flex items-center gap-2 text-sm text-slate-500" role="status"><Spinner /> Carregando job...</div>
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
    { rotulo: "Alvos", valor: job.total_alvos, cor: "text-slate-950" },
    { rotulo: "Sucesso", valor: job.total_sucesso, cor: "text-slate-950" },
    { rotulo: "Falhas", valor: job.total_falhas, cor: job.total_falhas > 0 ? "text-rose-700" : "text-slate-400" },
    { rotulo: "Pendentes", valor: job.pendentes, cor: job.pendentes > 0 ? "text-amber-800" : "text-slate-400" },
  ]
  return (
    <section className="bg-white rounded-xl border border-slate-200 p-5">
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-4 mb-5">
        {numeros.map((n) => (
          <div key={n.rotulo}>
            <dt className="text-[13px] text-slate-500">{n.rotulo}</dt>
            <dd className={`mt-1 text-2xl font-semibold tracking-tight ${n.cor}`}>{fmt.numero(n.valor)}</dd>
          </div>
        ))}
      </dl>

      <div className="flex justify-between text-[13px] mb-1.5">
        <span className="text-slate-500">Progresso</span>
        <span className="font-medium text-slate-950">{job.progresso_percentual.toLocaleString("pt-BR")}%</span>
      </div>
      <div className="h-2 w-full flex rounded-full overflow-hidden bg-slate-100 gap-px" aria-hidden="true">
        <div className="bg-slate-700 transition-[width] duration-500" style={{ width: pct(job.total_sucesso) }} />
        <div className="bg-rose-600 transition-[width] duration-500" style={{ width: pct(job.total_falhas) }} />
      </div>
      <div className="flex gap-4 mt-2 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-700" />Sucesso</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-rose-600" />Falhas</span>
      </div>

      <dl className="grid grid-cols-2 gap-4 mt-5 pt-4 border-t border-slate-200 text-[13px]">
        <div><dt className="text-slate-500">Início</dt><dd className="text-slate-950 mt-0.5">{fmt.dataHora(job.inicio_em)}</dd></div>
        <div><dt className="text-slate-500">Fim</dt><dd className="text-slate-950 mt-0.5">{job.fim_em ? fmt.dataHora(job.fim_em) : jobEmAndamento(job) ? "em andamento" : "—"}</dd></div>
      </dl>
      {job.pendentes > 0 && jobEmAndamento(job) && (
        <p className="text-[13px] text-slate-500 mt-4">
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
    <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-950">
          Comunicações {dados && <Contagem valor={fmt.numero(dados.total)} />}
        </h3>
        <div className="inline-flex flex-wrap p-1 rounded-lg bg-slate-100" role="group" aria-label="Filtrar por status">
          {FILTROS.map((f) => (
            <button
              key={f.valor || "todas"}
              onClick={() => { setFiltro(f.valor); setPagina(0) }}
              aria-pressed={filtro === f.valor}
              className={`h-7 px-2.5 rounded-md text-[13px] font-medium transition-colors ${
                filtro === f.valor ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-950"
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
        <EsqueletoTabela linhas={4} rotulo="Carregando comunicações" />
      ) : dados.itens.length === 0 ? (
        <Vazio
          titulo={filtro ? "Nenhuma comunicação com este status" : "Este job ainda não gerou comunicações"}
          descricao={filtro ? "Escolha outro status no filtro acima." : undefined}
        />
      ) : (
        <div className={`overflow-x-auto transition-opacity ${consulta.carregando ? "opacity-60" : ""}`}>
          <table className="w-full text-left text-[13px]">
            <thead className={THEAD}>
              <tr>
                {["Devedor", "Status", "Tentativas", "Enviado ou próximo reenvio", "Erro"].map((h) => (
                  <th key={h} className={`${TH} whitespace-nowrap`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className={TBODY}>
              {dados.itens.map((c) => {
                const status = fmt.STATUS_COMUNICACAO[c.status]
                const reenvio = c.status === "falha" && c.proxima_tentativa_em
                return (
                  <tr key={c.id} className="align-top">
                    <td className={`${TD} font-medium text-slate-950 max-w-[200px] truncate`} title={c.devedor_nome}>{c.devedor_nome}</td>
                    <td className={`${TD} whitespace-nowrap`}>
                      <Badge texto={reenvio ? "Falha, vai reenviar" : c.status === "falha" ? "Falha definitiva" : status.texto} classe={status.classe} />
                    </td>
                    <td className={`${TD} whitespace-nowrap`}>{c.tentativas} de {MAXIMO_TENTATIVAS}</td>
                    <td className={`${TD} whitespace-nowrap`}>
                      {c.enviado_em ? (
                        <span>{fmt.dataHora(c.enviado_em)}</span>
                      ) : reenvio ? (
                        <span className="text-amber-800">Reenvio às {fmt.dataHora(c.proxima_tentativa_em)}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className={`${TD} text-xs text-rose-700 min-w-[180px]`}>
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
  )
}
