import { useEffect, useState } from "react"
import DetalheJob from "../components/DetalheJob"
import { CONTEUDO, PAGINA, SUPERFICIE, TABELA, TBODY, TD, TD_NUM, TH, TH_NUM, THEAD, TR_CLICAVEL } from "../components/estilos"
import { jobEmAndamento } from "../lib/jobs"
import {
  AvisoErro,
  Badge,
  BOTAO_SECUNDARIO,
  CabecalhoPagina,
  Contagem,
  EsqueletoTabela,
  Paginacao,
  Painel,
  Selecao,
  Vazio,
} from "../components/ui"
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
    <div className={PAGINA}>
      <div className={CONTEUDO}>
        <CabecalhoPagina
          titulo="Monitoramento"
          descricao="Saúde dos serviços, janela de disparo e execução dos jobs da régua, com o resultado de cada comunicação."
        />

        {/* --- SERVIÇOS E JANELA --- */}
        <Servicos />

        {/* --- JOBS --- */}
        <Painel
          titulo={<>Jobs da régua {dados && <Contagem valor={fmt.numero(dados.total)} />}</>}
          subtitulo="Um job por regra e dia de referência. Clique em um job para ver as comunicações."
          acao={
            <div className="flex flex-wrap items-center gap-2">
              <Selecao
                value={status}
                onChange={(e) => { setStatus(e.target.value as StatusJob | ""); setPagina(0) }}
                aria-label="Filtrar por status"
                className="w-full sm:w-44"
              >
                <option value="">Todos os status</option>
                {STATUS.map((s) => <option key={s} value={s}>{fmt.STATUS_JOB[s].texto}</option>)}
              </Selecao>
              <Selecao
                value={regraId}
                onChange={(e) => { setRegraId(e.target.value); setPagina(0) }}
                aria-label="Filtrar por regra"
                className="w-full sm:w-56"
              >
                <option value="">Todas as regras</option>
                {regras.dados?.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </Selecao>
              <button onClick={jobs.recarregar} className={BOTAO_SECUNDARIO}>
                Atualizar
              </button>
            </div>
          }
        >
          {jobs.erro && !dados ? (
            <div className="p-5 sm:px-6"><AvisoErro mensagem={`Não foi possível carregar os jobs: ${jobs.erro}`} onTentarNovamente={jobs.recarregar} /></div>
          ) : !dados ? (
            <EsqueletoTabela rotulo="Carregando jobs" />
          ) : dados.itens.length === 0 ? (
            filtrando ? (
              <Vazio titulo="Nenhum job encontrado" descricao="Nenhum job corresponde aos filtros aplicados." />
            ) : (
              <Vazio titulo="Nenhum job executado ainda" descricao="Ative uma regra na régua de cobrança. Os jobs aparecem aqui assim que ela disparar." />
            )
          ) : (
            <div className={`overflow-x-auto transition-opacity ${jobs.carregando ? "opacity-60" : ""}`}>
              <table className={TABELA}>
                <thead className={THEAD}>
                  <tr>
                    <th className={TH}>Regra</th>
                    <th className={TH}>Canal</th>
                    <th className={TH}>Dia de referência</th>
                    <th className={TH}>Status</th>
                    <th className={TH}>Progresso</th>
                    <th className={TH_NUM}>Sucesso</th>
                    <th className={TH_NUM}>Falhas</th>
                    <th className={TH_NUM}>Pendentes</th>
                    <th className={TH}>Início</th>
                  </tr>
                </thead>
                <tbody className={TBODY}>
                  {dados.itens.map((job) => (
                    <LinhaJob key={job.id} job={job} onAbrir={() => onAbrirJob(job.id)} />
                  ))}
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
        </Painel>

        {dados?.itens.some(jobEmAndamento) && jobs.atualizadoEm && (
          <p className="text-center text-xs text-slate-500" role="status">
            Há jobs em andamento. Atualizado às {fmt.hora(jobs.atualizadoEm)}; a lista se renova a cada 15 segundos.
          </p>
        )}

        {jobId && <DetalheJob jobId={jobId} onFechar={() => { onAbrirJob(null); jobs.recarregar() }} />}
      </div>
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
      className={TR_CLICAVEL}
    >
      <td className={`${TD} font-medium text-slate-950 max-w-[240px] truncate`} title={job.regra_nome}>{job.regra_nome}</td>
      <td className={TD}>{fmt.NOME_CANAL[job.canal]}</td>
      <td className={`${TD} text-slate-500`}>{fmt.data(job.dia_referencia)}</td>
      <td className={TD}><Badge texto={status.texto} classe={status.classe} /></td>
      <td className={TD}>
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 flex gap-px rounded-full overflow-hidden bg-slate-100" aria-hidden="true">
            <div className="bg-slate-700" style={{ width: largura(job.total_sucesso) }} />
            <div className="bg-rose-600" style={{ width: largura(job.total_falhas) }} />
          </div>
          <span className="text-xs text-slate-500">{job.progresso_percentual.toLocaleString("pt-BR")}%</span>
        </div>
      </td>
      <td className={TD_NUM}>{fmt.numero(job.total_sucesso)}</td>
      <td className={`${TD_NUM} ${job.total_falhas > 0 ? "text-rose-700 font-medium" : "text-slate-400"}`}>{fmt.numero(job.total_falhas)}</td>
      <td className={`${TD_NUM} ${job.pendentes > 0 ? "text-amber-800 font-medium" : "text-slate-400"}`}>{fmt.numero(job.pendentes)}</td>
      <td className={`${TD} text-slate-500`}>{fmt.dataHora(job.inicio_em ?? job.criado_em)}</td>
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
    <section aria-label="Serviços" className={`${SUPERFICIE} grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 overflow-hidden`}>
      {dependencias.map((d) => {
        const ok = saude ? saude.dependencias[d] : null
        return (
          <Servico
            key={d}
            titulo={NOME_DEPENDENCIA[d]}
            estado={saude === undefined ? "verificando" : ok ? "ok" : "erro"}
            texto={saude === undefined ? "Verificando..." : saude === null ? "API sem resposta" : ok ? "Operacional" : "Fora do ar"}
            rodape={verificadoEm ? `Verificado às ${fmt.hora(verificadoEm)}` : ""}
          />
        )
      })}
      <Servico
        titulo="Janela de disparo"
        estado={janela.aberta ? "ok" : "neutro"}
        texto={janela.aberta ? "Aberta" : "Fechada"}
        rodape={`${janela.detalhe}. Segunda a sexta, das 8h às 19h55, exceto feriados.`}
      />
    </section>
  )
}

const ESTILO_ESTADO = {
  ok: { ponto: "bg-emerald-500", texto: "text-slate-950" },
  erro: { ponto: "bg-rose-600", texto: "text-rose-800" },
  neutro: { ponto: "bg-slate-400", texto: "text-slate-700" },
  verificando: { ponto: "bg-slate-300 animate-pulse", texto: "text-slate-500" },
}

function Servico({ titulo, estado, texto, rodape }: {
  titulo: string
  estado: keyof typeof ESTILO_ESTADO
  texto: string
  rodape: string
}) {
  const estilo = ESTILO_ESTADO[estado]
  return (
    <div className={`px-5 py-5 sm:px-6 -ml-px -mt-px border-l border-t border-slate-200 ${estado === "erro" ? "bg-rose-50/60" : ""}`}>
      <p className="text-[13px] text-slate-500">{titulo}</p>
      <p className={`mt-2 flex items-center gap-2 text-lg font-semibold ${estilo.texto}`}>
        <span className={`w-2 h-2 rounded-full ${estilo.ponto}`} aria-hidden="true" />
        {texto}
      </p>
      {rodape && <p className="text-xs text-slate-500 mt-1.5">{rodape}</p>}
    </div>
  )
}
