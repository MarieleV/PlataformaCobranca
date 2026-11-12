import { useEffect, useState, type ReactNode } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { Page } from "../auth/permissoes"
import { useApi } from "../hooks/useApi"
import { consultarSaude } from "../lib/api"
import * as fmt from "../lib/formatos"
import type { Dashboard as DadosDashboard, Job, Saude } from "../lib/tipos"

const PERIODOS = [7, 15, 30] as const
const ATUALIZAR_A_CADA_MS = 60_000

// Cores do gráfico por desfecho da comunicação
const CORES = {
  sucesso: "#10b981", // emerald-500
  falhas: "#f43f5e", // rose-500
  aguardando: "#cbd5e1", // slate-300
}

const NOME_DEPENDENCIA: Record<keyof Saude["dependencias"], string> = {
  postgres: "Banco de dados",
  redis: "Redis",
  rabbitmq: "Fila (RabbitMQ)",
}

interface DashboardProps {
  onNavigate?: (p: Page) => void
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [dias, setDias] = useState<number>(7)
  const { dados, erro, carregando, atualizadoEm, recarregar } = useApi<DadosDashboard>(
    `/dashboard/?dias=${dias}`,
    { intervaloMs: ATUALIZAR_A_CADA_MS },
  )

  return (
    <div className="p-4 md:p-6 xl:p-8 overflow-y-auto h-full bg-slate-50 font-sans space-y-6">

      {/* --- HEADER --- */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Dashboard Geral
          </h1>
          <p className="text-sm text-slate-500 mt-1 first-letter:uppercase">
            {fmt.dataLonga(new Date())} · Disparos automáticos de seg. a sex., das 8h às 19h
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SeletorPeriodo valor={dias} onChange={setDias} />
          <StatusSistema />
        </div>
      </div>

      {erro && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-rose-50 border border-rose-100 rounded-2xl" role="alert">
          <p className="text-sm font-semibold text-rose-700">
            {dados ? "Não foi possível atualizar os dados: " : "Não foi possível carregar o dashboard: "}
            <span className="font-medium">{erro}</span>
          </p>
          <button
            onClick={recarregar}
            className="self-start sm:self-auto px-3 py-1.5 rounded-lg text-xs font-bold text-rose-700 bg-white border border-rose-200 hover:bg-rose-100 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {!dados ? (
        carregando ? <Esqueleto /> : null
      ) : (
        <div className={`space-y-6 transition-opacity ${carregando ? "opacity-60" : ""}`}>
          <Kpis dados={dados} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <GraficoTimeline dados={dados} />
            <DistribuicaoCanais dados={dados} />
          </div>

          <TabelaLotes dados={dados} onNavigate={onNavigate} />
          <TabelaJobs dados={dados} onNavigate={onNavigate} />

          {atualizadoEm && (
            <p className="text-center text-[11px] font-mono text-slate-400">
              Atualizado às {fmt.hora(atualizadoEm)} · atualiza sozinho a cada minuto ·{" "}
              <button onClick={recarregar} className="underline hover:text-slate-700">
                atualizar agora
              </button>
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// --- Cabeçalho --------------------------------------------------------------

function SeletorPeriodo({ valor, onChange }: { valor: number; onChange: (d: number) => void }) {
  return (
    <div className="inline-flex p-1 rounded-xl bg-white border border-slate-200/80 shadow-sm" role="group" aria-label="Período">
      {PERIODOS.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          aria-pressed={valor === p}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            valor === p ? "bg-black text-white" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          {p} dias
        </button>
      ))}
    </div>
  )
}

/** Selo com o GET /health: verde se Postgres, Redis e RabbitMQ respondem. */
function StatusSistema() {
  const [saude, setSaude] = useState<Saude | null | undefined>(undefined) // undefined = consultando

  useEffect(() => {
    let controle = new AbortController()
    const consultar = () => {
      controle.abort()
      controle = new AbortController()
      consultarSaude(controle.signal).then(setSaude).catch(() => {})
    }
    consultar()
    const id = window.setInterval(consultar, ATUALIZAR_A_CADA_MS)
    return () => {
      window.clearInterval(id)
      controle.abort()
    }
  }, [])

  if (saude === undefined) return null

  const fora = saude
    ? (Object.keys(saude.dependencias) as (keyof Saude["dependencias"])[]).filter((d) => !saude.dependencias[d])
    : []
  const ok = saude !== null && fora.length === 0
  const texto = saude === null
    ? "API indisponível"
    : ok
      ? "Sistemas operacionais"
      : `Instável: ${fora.map((d) => NOME_DEPENDENCIA[d]).join(", ")}`

  return (
    <div
      className={`inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full border ${
        ok ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"
      }`}
      role="status"
    >
      <span className="relative flex h-2.5 w-2.5">
        {ok && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${ok ? "bg-emerald-500" : "bg-rose-500"}`}></span>
      </span>
      <span className={`text-xs font-semibold tracking-wide uppercase ${ok ? "text-emerald-700" : "text-rose-700"}`}>
        {texto}
      </span>
    </div>
  )
}

// --- KPIs -------------------------------------------------------------------

function Kpis({ dados }: { dados: DadosDashboard }) {
  const { base, hoje, periodo } = dados
  const taxa = periodo.taxa_entrega
  const meta = periodo.meta_taxa_entrega
  const corTaxa = taxa === null ? "text-slate-500" : taxa >= meta ? "text-emerald-600" : "text-amber-600"

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      <CardKpi
        titulo="Devedores na base"
        valor={fmt.numero(base.total)}
        icone={ICONES.devedores}
        corIcone="bg-blue-50 text-blue-600"
        rodape={
          <span className="text-slate-500">
            {fmt.numero(base.por_status.ativo)} ativos · {fmt.numero(base.por_status.negociando)} negociando ·{" "}
            {fmt.numero(base.por_status.quitado)} quitados
          </span>
        }
      />
      <CardKpi
        titulo="Disparos hoje"
        valor={fmt.numero(hoje.disparos)}
        icone={ICONES.disparos}
        corIcone="bg-violet-50 text-violet-600"
        rodape={
          <span className="text-slate-500">
            {fmt.numero(hoje.sucesso)} com sucesso · {fmt.numero(hoje.aguardando)} aguardando
          </span>
        }
      />
      <CardKpi
        titulo={`Taxa de entrega · ${dados.dias}d`}
        valor={fmt.percentual(taxa)}
        icone={ICONES.entrega}
        corIcone="bg-emerald-50 text-emerald-600"
        rodape={
          <span className={corTaxa}>
            {taxa === null
              ? "Sem disparos no período"
              : taxa >= meta
                ? `Dentro da meta de ${fmt.percentual(meta)}`
                : `Abaixo da meta de ${fmt.percentual(meta)}`}
          </span>
        }
      />
      <CardKpi
        titulo={`Falhas / bounces · ${dados.dias}d`}
        valor={fmt.numero(periodo.falhas)}
        icone={ICONES.falhas}
        corIcone="bg-rose-50 text-rose-600"
        rodape={
          <span className={hoje.falhas > 0 ? "text-rose-600" : "text-slate-500"}>
            {fmt.numero(hoje.falhas)} hoje · falhas definitivas, sem novo reenvio
          </span>
        }
      />
    </div>
  )
}

function CardKpi({ titulo, valor, icone, corIcone, rodape }: {
  titulo: string
  valor: string
  icone: ReactNode
  corIcone: string
  rodape: ReactNode
}) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm shadow-slate-200/50">
      <div className="flex items-start justify-between mb-4">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{titulo}</p>
        <div className={`p-2 rounded-lg ${corIcone}`}>{icone}</div>
      </div>
      <p className="text-3xl font-bold text-slate-900 mb-1">{valor}</p>
      <p className="text-xs font-medium">{rodape}</p>
    </div>
  )
}

// --- Gráfico ----------------------------------------------------------------

interface ItemTooltip {
  name?: string
  value?: number
  color?: string
}

function TooltipDia({ active, payload, label }: { active?: boolean; payload?: ItemTooltip[]; label?: string }) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((soma, p) => soma + (p.value ?? 0), 0)
  return (
    <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-lg shadow-slate-200/50">
      <p className="text-xs font-semibold text-slate-500 mb-2">{label} · {fmt.numero(total)} disparos</p>
      <div className="space-y-1">
        {payload.map((p) => (
          <p key={p.name} className="text-sm font-medium flex items-center gap-2 text-slate-700">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            {p.name}: <span className="font-bold">{fmt.numero(p.value ?? 0)}</span>
          </p>
        ))}
      </div>
    </div>
  )
}

function GraficoTimeline({ dados }: { dados: DadosDashboard }) {
  const pontos = dados.timeline.map((p) => ({
    dia: fmt.diaCurto(p.dia),
    sucesso: p.sucesso,
    falhas: p.falhas,
    aguardando: Math.max(p.disparos - p.sucesso - p.falhas, 0),
  }))
  const vazio = dados.timeline.every((p) => p.disparos === 0)

  return (
    <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm shadow-slate-200/50">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Volume de disparos</h2>
          <p className="text-xs text-slate-500 mt-1">
            Todos os canais, por dia · {fmt.data(dados.data_inicial)} a {fmt.data(dados.data_final)}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Legenda cor={CORES.sucesso} texto="Sucesso" />
          <Legenda cor={CORES.falhas} texto="Falhas" />
          <Legenda cor={CORES.aguardando} texto="Aguardando" />
        </div>
      </div>

      <div className="relative h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={pontos} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="dia" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} dy={10} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} dx={-10} />
            {!vazio && <Tooltip content={<TooltipDia />} cursor={{ fill: "#f1f5f9" }} />}
            <Bar dataKey="sucesso" name="Sucesso" stackId="d" fill={CORES.sucesso} maxBarSize={40} />
            <Bar dataKey="falhas" name="Falhas" stackId="d" fill={CORES.falhas} maxBarSize={40} />
            <Bar dataKey="aguardando" name="Aguardando" stackId="d" fill={CORES.aguardando} radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
        {vazio && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="px-4 py-2 rounded-xl bg-white/90 border border-slate-200 text-sm font-medium text-slate-500">
              Nenhum disparo nos últimos {dados.dias} dias
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cor }} />
      <span className="text-xs font-medium text-slate-600">{texto}</span>
    </div>
  )
}

// --- Canais -----------------------------------------------------------------

function DistribuicaoCanais({ dados }: { dados: DadosDashboard }) {
  const total = dados.periodo.disparos
  const { periodo } = dados

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm shadow-slate-200/50 flex flex-col">
      <h2 className="text-base font-bold text-slate-900">Distribuição por canal</h2>
      <p className="text-xs text-slate-500 mt-1 mb-6">Disparos e taxa de entrega nos últimos {dados.dias} dias</p>

      <div className="space-y-5 flex-1">
        {dados.por_canal.map((c) => {
          const fatia = total > 0 ? (c.disparos / total) * 100 : 0
          return (
            <div key={c.canal}>
              <div className="flex items-baseline justify-between mb-2">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: fmt.COR_CANAL[c.canal] }} />
                  {fmt.NOME_CANAL[c.canal]}
                </span>
                <span className="text-xs text-slate-500">
                  <span className="font-mono font-semibold text-slate-800">{fmt.numero(c.disparos)}</span> disparos ·{" "}
                  <span className="font-mono font-semibold text-slate-800">{fmt.percentual(c.taxa_entrega)}</span> entrega
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${fatia}%`, backgroundColor: fmt.COR_CANAL[c.canal] }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-6 pt-5 border-t border-slate-100">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Conversão</span>
          <span className="text-xl font-bold text-slate-900">{fmt.percentual(periodo.taxa_conversao)}</span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          {periodo.devedores_alcancados > 0
            ? `${fmt.numero(periodo.devedores_quitados)} de ${fmt.numero(periodo.devedores_alcancados)} devedores alcançados já estão quitados`
            : "Nenhum devedor alcançado no período"}
        </p>
      </div>
    </div>
  )
}

// --- Tabelas ----------------------------------------------------------------

function Painel({ titulo, acao, children }: { titulo: string; acao?: ReactNode; children: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm shadow-slate-200/50 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between gap-4">
        <h2 className="text-base font-bold text-slate-900">{titulo}</h2>
        {acao}
      </div>
      {children}
    </div>
  )
}

function BotaoAtalho({ texto, onClick }: { texto: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-xs font-bold text-slate-600 hover:text-black px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors"
    >
      {texto} →
    </button>
  )
}

function Badge({ texto, classe }: { texto: string; classe: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${classe}`}>
      {texto}
    </span>
  )
}

function Tabela({ colunas, vazio, children }: { colunas: string[]; vazio: string | null; children: ReactNode }) {
  if (vazio) {
    return <p className="px-6 py-10 text-center text-sm font-medium text-slate-400">{vazio}</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm whitespace-nowrap">
        <thead className="bg-slate-50/50">
          <tr>
            {colunas.map((h) => (
              <th key={h} className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  )
}

const TD = "px-6 py-4"
const TD_NUM = "px-6 py-4 text-slate-600 font-mono text-xs"

function TabelaLotes({ dados, onNavigate }: { dados: DadosDashboard; onNavigate?: (p: Page) => void }) {
  const lotes = dados.ultimos_lotes
  return (
    <Painel
      titulo="Últimos lotes importados"
      acao={onNavigate && <BotaoAtalho texto="Importar lote" onClick={() => onNavigate("importar")} />}
    >
      <Tabela
        colunas={["Arquivo", "Status", "Registros", "Importados", "Atualizados", "Rejeitados", "Enviado em"]}
        vazio={lotes.length === 0 ? "Nenhum lote importado ainda." : null}
      >
        {lotes.map((lote) => {
          const status = fmt.STATUS_LOTE[lote.status]
          const emAndamento = lote.status === "pendente" || lote.status === "processando"
          return (
            <tr key={lote.id} className="hover:bg-slate-50/80 transition-colors">
              <td className={`${TD} font-medium text-slate-800 max-w-[280px] truncate`} title={lote.nome_arquivo}>
                {lote.nome_arquivo}
              </td>
              <td className={TD}>
                <Badge
                  texto={emAndamento ? `${status.texto} · ${lote.progresso_percentual}%` : status.texto}
                  classe={status.classe}
                />
              </td>
              <td className={TD_NUM}>{fmt.numero(lote.total_registros)}</td>
              <td className={TD_NUM}>{fmt.numero(lote.total_importados)}</td>
              <td className={TD_NUM}>{fmt.numero(lote.total_atualizados)}</td>
              <td className={`${TD_NUM} ${lote.total_rejeitados > 0 ? "text-rose-600 font-semibold" : ""}`}>
                {fmt.numero(lote.total_rejeitados)}
              </td>
              <td className="px-6 py-4 text-slate-500 font-mono text-xs">{fmt.dataHora(lote.criado_em)}</td>
            </tr>
          )
        })}
      </Tabela>
    </Painel>
  )
}

/** % de sucesso sobre os alvos do job; null se o job não teve alvos. */
function taxaDoJob(job: Job): number | null {
  return job.total_alvos > 0 ? Math.round((job.total_sucesso / job.total_alvos) * 1000) / 10 : null
}

function TabelaJobs({ dados, onNavigate }: { dados: DadosDashboard; onNavigate?: (p: Page) => void }) {
  const jobs = dados.ultimos_jobs
  return (
    <Painel
      titulo="Últimos jobs da régua"
      acao={onNavigate && <BotaoAtalho texto="Monitoramento" onClick={() => onNavigate("monitoramento")} />}
    >
      <Tabela
        colunas={["Regra", "Canal", "Dia de referência", "Status", "Alvos", "Sucesso", "Falhas", "Taxa", "Início"]}
        vazio={jobs.length === 0 ? "Nenhum job executado ainda. Ative uma regra na Régua de Cobrança." : null}
      >
        {jobs.map((job) => {
          const status = fmt.STATUS_JOB[job.status]
          const taxa = taxaDoJob(job)
          return (
            <tr key={job.id} className="hover:bg-slate-50/80 transition-colors">
              <td className={`${TD} font-medium text-slate-800 max-w-[260px] truncate`} title={job.regra_nome}>
                {job.regra_nome}
              </td>
              <td className={TD}>
                <span className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: fmt.COR_CANAL[job.canal] }} />
                  {fmt.NOME_CANAL[job.canal]}
                </span>
              </td>
              <td className="px-6 py-4 text-slate-500 font-mono text-xs">{fmt.data(job.dia_referencia)}</td>
              <td className={TD}>
                <Badge
                  texto={job.status === "executando" ? `${status.texto} · ${job.progresso_percentual}%` : status.texto}
                  classe={status.classe}
                />
              </td>
              <td className={TD_NUM}>{fmt.numero(job.total_alvos)}</td>
              <td className={TD_NUM}>{fmt.numero(job.total_sucesso)}</td>
              <td className={`${TD_NUM} ${job.total_falhas > 0 ? "text-rose-600 font-semibold" : ""}`}>
                {fmt.numero(job.total_falhas)}
              </td>
              <td className={TD}>
                <span
                  className={`font-mono text-xs font-semibold ${
                    taxa === null ? "text-slate-400" : taxa >= dados.periodo.meta_taxa_entrega ? "text-emerald-600" : "text-amber-600"
                  }`}
                >
                  {fmt.percentual(taxa)}
                </span>
              </td>
              <td className="px-6 py-4 text-slate-500 font-mono text-xs">{fmt.dataHora(job.inicio_em ?? job.criado_em)}</td>
            </tr>
          )
        })}
      </Tabela>
    </Painel>
  )
}

// --- Carregando ---------------------------------------------------------------

function Esqueleto() {
  return (
    <div className="space-y-6 animate-pulse" aria-label="Carregando dashboard">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[148px] bg-white rounded-2xl border border-slate-200/60" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-[380px] bg-white rounded-2xl border border-slate-200/60" />
        <div className="h-[380px] bg-white rounded-2xl border border-slate-200/60" />
      </div>
      <div className="h-[240px] bg-white rounded-2xl border border-slate-200/60" />
    </div>
  )
}

// --- Ícones -------------------------------------------------------------------

const ICONES = {
  devedores: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  disparos: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  ),
  entrega: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  falhas: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
}
