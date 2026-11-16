import { useState, type ReactNode } from "react"
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
import { PAGINA, CONTEUDO, SUPERFICIE, TABELA, TBODY, TD, TD_NUM, TH, TH_NUM, THEAD, TR_CLICAVEL } from "../components/estilos"
import { AvisoErro, Badge, BOTAO_SECUNDARIO_P, CabecalhoPagina, Painel, Vazio } from "../components/ui"
import { useApi } from "../hooks/useApi"
import { dependenciasFora, useSaude } from "../hooks/useSaude"
import * as fmt from "../lib/formatos"
import type { Dashboard as DadosDashboard, Job, Saude } from "../lib/tipos"

const PERIODOS = [7, 15, 30] as const
const ATUALIZAR_A_CADA_MS = 60_000

// Cores do gráfico por desfecho. Sucesso é o estado normal (tinta); só a falha ganha cor.
// Tinta x vermelho separa bem também para daltonismo (verde x vermelho não separava).
const CORES = {
  sucesso: "#334155", // slate-700
  falhas: "#e11d48", // rose-600
  aguardando: "#94a3b8", // slate-400
}

// Nomes curtos para o selo do cabeçalho (o Monitoramento usa os longos de useSaude)
const NOME_DEPENDENCIA: Record<keyof Saude["dependencias"], string> = {
  postgres: "Banco de dados",
  redis: "Redis",
  rabbitmq: "Fila (RabbitMQ)",
}

interface DashboardProps {
  onNavigate?: (p: Page) => void
  /** Abre o relatório de validação de um lote. */
  onAbrirLote?: (loteId: string) => void
  /** Abre um job no Monitoramento. */
  onAbrirJob?: (jobId: string) => void
}

export default function Dashboard({ onNavigate, onAbrirLote, onAbrirJob }: DashboardProps) {
  const [dias, setDias] = useState<number>(7)
  const { dados, erro, carregando, atualizadoEm, recarregar } = useApi<DadosDashboard>(
    `/dashboard/?dias=${dias}`,
    { intervaloMs: ATUALIZAR_A_CADA_MS },
  )

  return (
    <div className={PAGINA}>
      <div className={CONTEUDO}>
        <CabecalhoPagina
          titulo="Dashboard"
          descricao={
            <span className="inline-block first-letter:uppercase">
              {fmt.dataLonga(new Date())}. Disparos automáticos de segunda a sexta, das 8h às 19h55.
            </span>
          }
          acoes={
            <>
              <StatusSistema />
              <SeletorPeriodo valor={dias} onChange={setDias} />
            </>
          }
        />

        {erro && (
          <AvisoErro
            mensagem={
              <>
                {dados ? "Não foi possível atualizar os dados: " : "Não foi possível carregar o dashboard: "}
                {erro}
              </>
            }
            onTentarNovamente={recarregar}
          />
        )}

        {!dados ? (
          carregando ? <Esqueleto /> : null
        ) : (
          <div className={`space-y-6 transition-opacity ${carregando ? "opacity-60" : ""}`}>
            <Kpis dados={dados} />

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <GraficoTimeline dados={dados} />
              <DistribuicaoCanais dados={dados} />
            </div>

            <TabelaLotes dados={dados} onNavigate={onNavigate} onAbrirLote={onAbrirLote} />
            <TabelaJobs dados={dados} onNavigate={onNavigate} onAbrirJob={onAbrirJob} />

            {atualizadoEm && (
              <p className="text-center text-xs text-slate-500">
                Atualizado às {fmt.hora(atualizadoEm)}. Os dados se renovam a cada minuto.{" "}
                <button onClick={recarregar} className="font-medium text-slate-700 underline underline-offset-2 hover:text-slate-950">
                  Atualizar agora
                </button>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// --- Cabeçalho --------------------------------------------------------------

function SeletorPeriodo({ valor, onChange }: { valor: number; onChange: (d: number) => void }) {
  return (
    <div className="inline-flex h-10 p-1 rounded-lg bg-slate-100" role="group" aria-label="Período">
      {PERIODOS.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          aria-pressed={valor === p}
          className={`px-3 rounded-md text-[13px] font-medium transition-colors ${
            valor === p ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-950"
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
  const { saude } = useSaude(ATUALIZAR_A_CADA_MS)
  if (saude === undefined) return null

  const fora = dependenciasFora(saude)
  const ok = saude !== null && fora.length === 0
  const texto = saude === null
    ? "API indisponível"
    : ok
      ? "Sistemas operacionais"
      : `Instável: ${fora.map((d) => NOME_DEPENDENCIA[d]).join(", ")}`

  return (
    <span
      className={`inline-flex items-center gap-2 h-8 px-3 rounded-full text-[13px] ${
        ok ? "text-slate-600" : "bg-rose-50 text-rose-800 font-medium"
      }`}
      role="status"
    >
      <span className={`w-2 h-2 rounded-full ${ok ? "bg-emerald-500" : "bg-rose-600"}`} aria-hidden="true" />
      {texto}
    </span>
  )
}

// --- KPIs -------------------------------------------------------------------

/** Faixa única com os quatro indicadores, separados por linhas (não quatro cards soltos). */
function Kpis({ dados }: { dados: DadosDashboard }) {
  const { base, hoje, periodo } = dados
  const taxa = periodo.taxa_entrega
  const meta = periodo.meta_taxa_entrega

  return (
    <section aria-label="Indicadores" className={`${SUPERFICIE} grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 overflow-hidden`}>
      <Kpi
        titulo="Devedores na base"
        valor={fmt.numero(base.total)}
        rodape={
          <>
            {fmt.numero(base.por_status.ativo)} ativos, {fmt.numero(base.por_status.negociando)} negociando,{" "}
            {fmt.numero(base.por_status.quitado)} quitados
          </>
        }
      />
      <Kpi
        titulo="Disparos hoje"
        valor={fmt.numero(hoje.disparos)}
        rodape={<>{fmt.numero(hoje.sucesso)} com sucesso, {fmt.numero(hoje.aguardando)} aguardando</>}
      />
      <Kpi
        titulo={`Taxa de entrega em ${dados.dias} dias`}
        valor={fmt.percentual(taxa)}
        sinal={taxa === null ? undefined : taxa >= meta ? "bom" : "atencao"}
        rodape={
          taxa === null
            ? "Sem disparos no período"
            : taxa >= meta
              ? `Dentro da meta de ${fmt.percentual(meta)}`
              : `Abaixo da meta de ${fmt.percentual(meta)}`
        }
      />
      <Kpi
        titulo={`Falhas e bounces em ${dados.dias} dias`}
        valor={fmt.numero(periodo.falhas)}
        sinal={hoje.falhas > 0 ? "ruim" : undefined}
        rodape={<>{fmt.numero(hoje.falhas)} hoje. Falhas definitivas, sem novo reenvio.</>}
      />
    </section>
  )
}

const SINAL = {
  bom: { cor: "text-emerald-800", d: "M5 13l4 4L19 7" },
  atencao: { cor: "text-amber-800", d: "M12 8v5m0 4h.01" },
  ruim: { cor: "text-rose-800", d: "M12 8v5m0 4h.01" },
} as const

function Kpi({ titulo, valor, rodape, sinal }: {
  titulo: string
  valor: string
  rodape: ReactNode
  /** Estado do indicador: dá cor e ícone ao rodapé (nunca só a cor). */
  sinal?: keyof typeof SINAL
}) {
  const estilo = sinal ? SINAL[sinal] : null
  return (
    // As linhas entre os indicadores: -ml/-mt de 1px escondem a borda que encosta na lateral do painel
    <div className="px-5 py-5 sm:px-6 -ml-px -mt-px border-l border-t border-slate-200">
      <p className="text-[13px] text-slate-500">{titulo}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{valor}</p>
      <p className={`mt-2 flex items-start gap-1.5 text-[13px] ${estilo ? `${estilo.cor} font-medium` : "text-slate-500"}`}>
        {estilo && (
          <svg className="w-4 h-4 mt-px flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d={estilo.d} />
          </svg>
        )}
        <span>{rodape}</span>
      </p>
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
    <div className="bg-white border border-slate-200 px-3 py-2.5 rounded-lg shadow-lg shadow-slate-950/10 min-w-[160px]">
      <p className="text-xs text-slate-500 mb-1.5">
        {label}: <span className="font-medium text-slate-800">{fmt.numero(total)} disparos</span>
      </p>
      <div className="space-y-1">
        {/* Ordem do empilhamento invertida: o topo da barra aparece primeiro */}
        {[...payload].reverse().map((p) => (
          <p key={p.name} className="text-[13px] flex items-center gap-2 text-slate-600">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
            <span className="flex-1">{p.name}</span>
            <span className="font-medium text-slate-950">{fmt.numero(p.value ?? 0)}</span>
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
    <section className={`xl:col-span-2 ${SUPERFICIE} p-5 sm:p-6`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-5 gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Volume de disparos</h2>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Todos os canais, por dia, de {fmt.data(dados.data_inicial)} a {fmt.data(dados.data_final)}
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
          <BarChart data={pontos} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#eef2f6" />
            <XAxis dataKey="dia" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} dy={8} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} dx={-6} />
            {!vazio && <Tooltip content={<TooltipDia />} cursor={{ fill: "#f1f5f9" }} />}
            {/* Contorno branco de 2px separa os segmentos empilhados */}
            <Bar dataKey="sucesso" name="Sucesso" stackId="d" fill={CORES.sucesso} stroke="#fff" strokeWidth={2} maxBarSize={36} />
            <Bar dataKey="falhas" name="Falhas" stackId="d" fill={CORES.falhas} stroke="#fff" strokeWidth={2} maxBarSize={36} />
            <Bar dataKey="aguardando" name="Aguardando" stackId="d" fill={CORES.aguardando} stroke="#fff" strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
        {vazio && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-[13px] text-slate-600">
              Nenhum disparo nos últimos {dados.dias} dias
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[13px] text-slate-600">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: cor }} />
      {texto}
    </span>
  )
}

// --- Canais -----------------------------------------------------------------

function DistribuicaoCanais({ dados }: { dados: DadosDashboard }) {
  const total = dados.periodo.disparos
  const { periodo } = dados

  return (
    <section className={`${SUPERFICIE} p-5 sm:p-6 flex flex-col`}>
      <h2 className="text-base font-semibold text-slate-950">Distribuição por canal</h2>
      <p className="text-[13px] text-slate-500 mt-0.5 mb-6">Disparos e taxa de entrega nos últimos {dados.dias} dias</p>

      <div className="space-y-5 flex-1">
        {dados.por_canal.map((c) => {
          const fatia = total > 0 ? (c.disparos / total) * 100 : 0
          return (
            <div key={c.canal}>
              <div className="flex items-baseline justify-between gap-3 mb-2">
                <span className="text-sm font-medium text-slate-800">{fmt.NOME_CANAL[c.canal]}</span>
                <span className="text-[13px] text-slate-500 text-right">
                  <span className="font-medium text-slate-950">{fmt.numero(c.disparos)}</span> disparos,{" "}
                  <span className="font-medium text-slate-950">{fmt.percentual(c.taxa_entrega)}</span> entrega
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
                <div className="h-full rounded-full bg-slate-700 transition-[width] duration-500" style={{ width: `${fatia}%` }} />
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-6 pt-5 border-t border-slate-200">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] text-slate-500">Conversão</span>
          <span className="text-2xl font-semibold tracking-tight text-slate-950">{fmt.percentual(periodo.taxa_conversao)}</span>
        </div>
        <p className="text-[13px] text-slate-500 mt-1">
          {periodo.devedores_alcancados > 0
            ? `${fmt.numero(periodo.devedores_quitados)} de ${fmt.numero(periodo.devedores_alcancados)} devedores alcançados já estão quitados`
            : "Nenhum devedor alcançado no período"}
        </p>
      </div>
    </section>
  )
}

// --- Tabelas ----------------------------------------------------------------

function BotaoAtalho({ texto, onClick }: { texto: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={BOTAO_SECUNDARIO_P}>
      {texto}
    </button>
  )
}

interface Coluna {
  titulo: string
  numero?: boolean
}

function Tabela({ colunas, vazio, children }: { colunas: Coluna[]; vazio: ReactNode; children: ReactNode }) {
  if (vazio) return vazio
  return (
    <div className="overflow-x-auto">
      <table className={TABELA}>
        <thead className={THEAD}>
          <tr>
            {colunas.map((c) => (
              <th key={c.titulo} className={c.numero ? TH_NUM : TH}>{c.titulo}</th>
            ))}
          </tr>
        </thead>
        <tbody className={TBODY}>{children}</tbody>
      </table>
    </div>
  )
}

function TabelaLotes({ dados, onNavigate, onAbrirLote }: {
  dados: DadosDashboard
  onNavigate?: (p: Page) => void
  onAbrirLote?: (loteId: string) => void
}) {
  const lotes = dados.ultimos_lotes
  return (
    <Painel
      titulo="Últimos lotes importados"
      subtitulo={onAbrirLote && lotes.length > 0 ? "Clique em um lote para ver o relatório de validação." : undefined}
      acao={onNavigate && <BotaoAtalho texto="Importar lote" onClick={() => onNavigate("importar")} />}
    >
      <Tabela
        colunas={[
          { titulo: "Arquivo" }, { titulo: "Status" }, { titulo: "Registros", numero: true },
          { titulo: "Importados", numero: true }, { titulo: "Atualizados", numero: true },
          { titulo: "Rejeitados", numero: true }, { titulo: "Enviado em" },
        ]}
        vazio={lotes.length === 0 ? <Vazio titulo="Nenhum lote importado ainda" descricao="Os lotes enviados aparecem aqui com o resultado da validação." /> : null}
      >
        {lotes.map((lote) => {
          const status = fmt.STATUS_LOTE[lote.status]
          const emAndamento = lote.status === "pendente" || lote.status === "processando"
          return (
            <tr key={lote.id} onClick={onAbrirLote && (() => onAbrirLote(lote.id))} className={onAbrirLote ? TR_CLICAVEL : ""}>
              <td className={`${TD} font-medium text-slate-950 max-w-[280px] truncate`} title={lote.nome_arquivo}>
                {lote.nome_arquivo}
              </td>
              <td className={TD}>
                <Badge texto={emAndamento ? `${status.texto}, ${lote.progresso_percentual}%` : status.texto} classe={status.classe} />
              </td>
              <td className={TD_NUM}>{fmt.numero(lote.total_registros)}</td>
              <td className={TD_NUM}>{fmt.numero(lote.total_importados)}</td>
              <td className={TD_NUM}>{fmt.numero(lote.total_atualizados)}</td>
              <td className={`${TD_NUM} ${lote.total_rejeitados > 0 ? "text-rose-700 font-medium" : ""}`}>
                {fmt.numero(lote.total_rejeitados)}
              </td>
              <td className={`${TD} text-slate-500`}>{fmt.dataHora(lote.criado_em)}</td>
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

function TabelaJobs({ dados, onNavigate, onAbrirJob }: {
  dados: DadosDashboard
  onNavigate?: (p: Page) => void
  onAbrirJob?: (jobId: string) => void
}) {
  const jobs = dados.ultimos_jobs
  return (
    <Painel
      titulo="Últimos jobs da régua"
      subtitulo={onAbrirJob && jobs.length > 0 ? "Clique em um job para ver as comunicações." : undefined}
      acao={onNavigate && <BotaoAtalho texto="Abrir monitoramento" onClick={() => onNavigate("monitoramento")} />}
    >
      <Tabela
        colunas={[
          { titulo: "Regra" }, { titulo: "Canal" }, { titulo: "Dia de referência" }, { titulo: "Status" },
          { titulo: "Alvos", numero: true }, { titulo: "Sucesso", numero: true }, { titulo: "Falhas", numero: true },
          { titulo: "Taxa", numero: true }, { titulo: "Início" },
        ]}
        vazio={jobs.length === 0 ? <Vazio titulo="Nenhum job executado ainda" descricao="Ative uma regra na régua de cobrança para começar os disparos." /> : null}
      >
        {jobs.map((job) => {
          const status = fmt.STATUS_JOB[job.status]
          const taxa = taxaDoJob(job)
          return (
            <tr key={job.id} onClick={onAbrirJob && (() => onAbrirJob(job.id))} className={onAbrirJob ? TR_CLICAVEL : ""}>
              <td className={`${TD} font-medium text-slate-950 max-w-[260px] truncate`} title={job.regra_nome}>
                {job.regra_nome}
              </td>
              <td className={TD}>{fmt.NOME_CANAL[job.canal]}</td>
              <td className={`${TD} text-slate-500`}>{fmt.data(job.dia_referencia)}</td>
              <td className={TD}>
                <Badge
                  texto={job.status === "executando" ? `${status.texto}, ${job.progresso_percentual}%` : status.texto}
                  classe={status.classe}
                />
              </td>
              <td className={TD_NUM}>{fmt.numero(job.total_alvos)}</td>
              <td className={TD_NUM}>{fmt.numero(job.total_sucesso)}</td>
              <td className={`${TD_NUM} ${job.total_falhas > 0 ? "text-rose-700 font-medium" : ""}`}>
                {fmt.numero(job.total_falhas)}
              </td>
              <td
                className={`${TD_NUM} font-medium ${
                  taxa === null ? "text-slate-400" : taxa >= dados.periodo.meta_taxa_entrega ? "text-emerald-800" : "text-amber-800"
                }`}
              >
                {fmt.percentual(taxa)}
              </td>
              <td className={`${TD} text-slate-500`}>{fmt.dataHora(job.inicio_em ?? job.criado_em)}</td>
            </tr>
          )
        })}
      </Tabela>
    </Painel>
  )
}

// --- Carregando ---------------------------------------------------------------

function Esqueleto() {
  const bloco = "bg-white rounded-xl border border-slate-200"
  return (
    <div className="space-y-6 animate-pulse" role="status" aria-label="Carregando dashboard">
      <div className={`${bloco} h-[132px]`} />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className={`xl:col-span-2 h-[380px] ${bloco}`} />
        <div className={`h-[380px] ${bloco}`} />
      </div>
      <div className={`h-[240px] ${bloco}`} />
    </div>
  )
}
