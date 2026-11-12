import { useState } from "react"
import { useAuth } from "../auth/AuthContext"
import { PERFIS_POR_ACAO } from "../auth/permissoes"
import EditorRegra, { TemplateDestacado } from "../components/EditorRegra"
import {
  AvisoErro,
  BOTAO_PERIGO,
  BOTAO_PRIMARIO,
  BOTAO_SECUNDARIO,
  Badge,
  Modal,
  Painel,
  Spinner,
} from "../components/ui"
import { useApi } from "../hooks/useApi"
import { ApiError, apiFetch } from "../lib/api"
import * as fmt from "../lib/formatos"
import { DIAS_PARA_TRAS } from "../lib/regua"
import type { Canal, Devedor, MensagemResponse, Pagina, Regra, StatusRegua } from "../lib/tipos"

const CANAIS: Canal[] = ["email", "sms", "whatsapp"]
const ELEGIVEIS_POR_PAGINA = 20

// Destaque do card selecionado e do switch, na cor do canal
const ESTILO_CANAL: Record<Canal, { badge: string; selecionado: string; switch: string }> = {
  email: { badge: "bg-blue-50 text-blue-700 border-blue-200", selecionado: "border-blue-500 ring-1 ring-blue-500 shadow-md shadow-blue-500/10", switch: "bg-blue-500" },
  sms: { badge: "bg-violet-50 text-violet-700 border-violet-200", selecionado: "border-violet-500 ring-1 ring-violet-500 shadow-md shadow-violet-500/10", switch: "bg-violet-500" },
  whatsapp: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", selecionado: "border-emerald-500 ring-1 ring-emerald-500 shadow-md shadow-emerald-500/10", switch: "bg-emerald-500" },
}

type Editor = { modo: "novo" } | { modo: "editar"; regra: Regra } | null

function mensagemDe(e: unknown, padrao: string): string {
  return e instanceof ApiError ? e.message : padrao
}

export default function ReguaCobranca() {
  const { pode } = useAuth()
  const podeGerenciar = pode(PERFIS_POR_ACAO.gerenciarRegua)

  const lista = useApi<Regra[]>("/regras/")
  const status = useApi<StatusRegua>("/regras/status")
  const recarregar = () => {
    lista.recarregar()
    status.recarregar()
  }

  const [filtroCanal, setFiltroCanal] = useState<Canal | "">("")
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null)
  const [editor, setEditor] = useState<Editor>(null)
  const [executando, setExecutando] = useState<Regra | null>(null)
  const [excluindo, setExcluindo] = useState<Regra | null>(null)
  const [alternandoId, setAlternandoId] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [erroAcao, setErroAcao] = useState<string | null>(null)

  const regras = (lista.dados ?? []).filter((r) => !filtroCanal || r.canal === filtroCanal)
  const selecionada = regras.find((r) => r.id === selecionadaId) ?? regras[0] ?? null

  const avisar = (texto: string) => {
    setErroAcao(null)
    setAviso(texto)
  }

  const alternarAtiva = async (regra: Regra) => {
    setAviso(null)
    setErroAcao(null)
    setAlternandoId(regra.id)
    try {
      await apiFetch<Regra>(`/regras/${regra.id}/${regra.ativa ? "desativar" : "ativar"}`, { method: "POST" })
      avisar(regra.ativa ? `Regra "${regra.nome}" desativada.` : `Regra "${regra.nome}" ativada: entra no próximo ciclo de disparo.`)
      recarregar()
    } catch (e) {
      setErroAcao(mensagemDe(e, "Erro inesperado ao alterar a regra."))
    } finally {
      setAlternandoId(null)
    }
  }

  return (
    <div className="p-4 md:p-6 xl:p-8 overflow-y-auto h-full bg-slate-50 font-sans space-y-6">

      {/* --- HEADER --- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Régua de Cobrança
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Cada regra envia uma mensagem por um canal quando o atraso do devedor chega ao prazo definido.
          </p>
        </div>
        {podeGerenciar && (
          <button
            onClick={() => setEditor({ modo: "novo" })}
            className="self-start sm:self-auto px-5 py-2.5 rounded-xl bg-black hover:bg-slate-800 active:bg-slate-900 text-white text-sm font-bold shadow-xl shadow-black/10 transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
            Nova regra
          </button>
        )}
      </div>

      {/* --- STATUS DA RÉGUA + FILTRO --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {status.dados ? (
          <div
            className={`inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl border text-sm font-semibold ${
              status.dados.regua_ativa ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-amber-50 border-amber-200 text-amber-700"
            }`}
            role="status"
          >
            <span className={`w-2 h-2 rounded-full ${status.dados.regua_ativa ? "bg-emerald-500" : "bg-amber-500"}`} />
            {status.dados.mensagem}
            <span className="font-mono text-xs opacity-80">
              · {status.dados.regras_ativas} de {status.dados.total_regras} regras ativas
            </span>
          </div>
        ) : (
          <span />
        )}

        <div className="inline-flex p-1 rounded-xl bg-white border border-slate-200/80 shadow-sm self-start" role="group" aria-label="Filtrar por canal">
          {(["", ...CANAIS] as const).map((c) => (
            <button
              key={c || "todos"}
              onClick={() => setFiltroCanal(c)}
              aria-pressed={filtroCanal === c}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                filtroCanal === c ? "bg-black text-white" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {c ? fmt.NOME_CANAL[c] : "Todos"}
            </button>
          ))}
        </div>
      </div>

      {aviso && (
        <div className="flex items-center justify-between gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl" role="status">
          <p className="text-sm font-semibold text-emerald-700">{aviso}</p>
          <button onClick={() => setAviso(null)} className="text-xs font-bold text-emerald-700 hover:underline">Fechar</button>
        </div>
      )}
      {erroAcao && <AvisoErro mensagem={erroAcao} />}
      {lista.erro && !lista.dados && (
        <AvisoErro mensagem={`Não foi possível carregar as regras: ${lista.erro}`} onTentarNovamente={recarregar} />
      )}
      {!podeGerenciar && (
        <p className="text-xs font-medium text-slate-500">
          Você pode consultar as regras e os devedores elegíveis. Criar, editar e ativar regras é permitido ao gestor e ao administrador.
        </p>
      )}

      {/* --- CARDS --- */}
      {!lista.dados && lista.carregando ? (
        <div className="flex items-center gap-2 text-sm font-medium text-slate-500"><Spinner /> Carregando regras...</div>
      ) : lista.dados && regras.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 border border-slate-200/60 shadow-sm text-center">
          <p className="font-bold text-slate-900 text-lg mb-1">
            {filtroCanal ? `Nenhuma regra de ${fmt.NOME_CANAL[filtroCanal]}` : "Nenhuma regra cadastrada"}
          </p>
          <p className="text-sm text-slate-500">
            {podeGerenciar ? "Crie uma regra para começar a cobrança automática." : "Peça a um gestor para cadastrar as regras da régua."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {regras.map((r) => (
            <CardRegra
              key={r.id}
              regra={r}
              selecionada={selecionada?.id === r.id}
              onSelecionar={() => setSelecionadaId(r.id)}
              podeAlternar={podeGerenciar}
              alternando={alternandoId === r.id}
              onAlternar={() => void alternarAtiva(r)}
            />
          ))}
        </div>
      )}

      {/* --- DETALHE + ELEGÍVEIS --- */}
      {selecionada && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <DetalheRegra
            regra={selecionada}
            podeGerenciar={podeGerenciar}
            onEditar={() => setEditor({ modo: "editar", regra: selecionada })}
            onExecutar={() => setExecutando(selecionada)}
            onExcluir={() => setExcluindo(selecionada)}
          />
          {/* key: trocar de regra volta para a primeira página */}
          <Elegiveis key={selecionada.id} regra={selecionada} />
        </div>
      )}

      {editor && (
        <EditorRegra
          regra={editor.modo === "editar" ? editor.regra : undefined}
          onFechar={() => setEditor(null)}
          onSalvo={(r) => {
            setEditor(null)
            setSelecionadaId(r.id)
            avisar(editor.modo === "novo" ? `Regra "${r.nome}" criada (inativa). Ative-a para começar os disparos.` : `Regra "${r.nome}" atualizada.`)
            recarregar()
          }}
        />
      )}
      {executando && (
        <ModalExecutar
          regra={executando}
          onFechar={() => setExecutando(null)}
          onExecutado={(msg) => {
            setExecutando(null)
            avisar(msg)
          }}
        />
      )}
      {excluindo && (
        <ModalExcluir
          regra={excluindo}
          onFechar={() => setExcluindo(null)}
          onExcluida={() => {
            setExcluindo(null)
            setSelecionadaId(null)
            avisar(`Regra "${excluindo.nome}" excluída.`)
            recarregar()
          }}
          onDesativar={() => {
            setExcluindo(null)
            void alternarAtiva(excluindo)
          }}
        />
      )}
    </div>
  )
}

// --- Card ---------------------------------------------------------------------

function CardRegra({ regra, selecionada, onSelecionar, podeAlternar, alternando, onAlternar }: {
  regra: Regra
  selecionada: boolean
  onSelecionar: () => void
  podeAlternar: boolean
  alternando: boolean
  onAlternar: () => void
}) {
  const estilo = ESTILO_CANAL[regra.canal]
  return (
    <div
      onClick={onSelecionar}
      onKeyDown={(e) => { if (e.key === "Enter") onSelecionar() }}
      tabIndex={0}
      role="button"
      aria-pressed={selecionada}
      className={`rounded-2xl p-5 cursor-pointer transition-all duration-200 border bg-white outline-none focus-visible:ring-4 focus-visible:ring-black/10 ${
        selecionada ? estilo.selecionado : "border-slate-200/80 hover:border-slate-300 shadow-sm shadow-slate-200/50"
      } ${!regra.ativa && !selecionada ? "opacity-70" : ""}`}
    >
      <div className="flex items-start justify-between mb-4">
        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold font-mono tracking-wider uppercase border ${estilo.badge}`}>
          {fmt.NOME_CANAL[regra.canal]}
        </span>
        {podeAlternar ? (
          <button
            onClick={(e) => { e.stopPropagation(); onAlternar() }}
            disabled={alternando}
            role="switch"
            aria-checked={regra.ativa}
            aria-label={regra.ativa ? "Desativar regra" : "Ativar regra"}
            title={regra.ativa ? "Desativar regra" : "Ativar regra"}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-wait ${
              regra.ativa ? estilo.switch : "bg-slate-200"
            }`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-200 shadow-sm ${regra.ativa ? "translate-x-4" : "translate-x-1"}`} />
          </button>
        ) : (
          <span className={`text-[10px] font-bold uppercase tracking-wider ${regra.ativa ? "text-emerald-600" : "text-slate-400"}`}>
            {regra.ativa ? "Ativa" : "Inativa"}
          </span>
        )}
      </div>

      <p className="font-bold text-slate-900 text-sm mb-1 line-clamp-1 tracking-tight" title={regra.nome}>{regra.nome}</p>
      <p className="text-xs font-mono font-bold text-slate-500 mb-3">
        D+{regra.dias_atraso} · a partir das {fmt.horario(regra.horario_disparo)}
      </p>
      <p className="text-xs text-slate-500 line-clamp-2 pt-3 border-t border-slate-100">{regra.template_mensagem}</p>
    </div>
  )
}

// --- Detalhe ------------------------------------------------------------------

function DetalheRegra({ regra, podeGerenciar, onEditar, onExecutar, onExcluir }: {
  regra: Regra
  podeGerenciar: boolean
  onEditar: () => void
  onExecutar: () => void
  onExcluir: () => void
}) {
  const estilo = ESTILO_CANAL[regra.canal]
  const campos = [
    { rotulo: "Canal", valor: fmt.NOME_CANAL[regra.canal] },
    { rotulo: "Prazo", valor: `D+${regra.dias_atraso} (dias após o vencimento)` },
    { rotulo: "Horário", valor: `A partir das ${fmt.horario(regra.horario_disparo)} (seg. a sex.)` },
    { rotulo: "Situação", valor: regra.ativa ? "Ativa — disparando" : "Inativa — não dispara" },
    { rotulo: "Criada em", valor: fmt.dataHora(regra.criado_em) },
  ]

  return (
    <div className="lg:col-span-5 bg-white rounded-3xl p-7 border border-slate-200/80 shadow-sm shadow-slate-200/50 flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-6">
        <p className="font-bold text-lg text-slate-900 tracking-tight break-words">{regra.nome}</p>
        <span className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex-shrink-0 ${estilo.badge}`}>{fmt.NOME_CANAL[regra.canal]}</span>
      </div>

      <div className="space-y-1 mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
        {campos.map((c) => (
          <div key={c.rotulo} className="flex items-center justify-between gap-4 py-2 border-b border-slate-200/50 last:border-0">
            <span className="text-xs font-medium text-slate-500">{c.rotulo}</span>
            <span className={`text-xs font-bold text-right ${c.rotulo === "Situação" ? (regra.ativa ? "text-emerald-600" : "text-slate-400") : "text-slate-900"}`}>
              {c.valor}
            </span>
          </div>
        ))}
      </div>

      <div className="flex-1">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Template de mensagem</p>
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 font-mono text-[13px] text-slate-700 leading-relaxed shadow-inner max-h-56 overflow-y-auto whitespace-pre-wrap break-words">
          <TemplateDestacado template={regra.template_mensagem} />
        </div>
      </div>

      {podeGerenciar && (
        <div className="flex flex-wrap gap-3 mt-8 pt-6 border-t border-slate-100">
          <button onClick={onEditar} className={`flex-1 ${BOTAO_SECUNDARIO}`}>Editar</button>
          <button
            onClick={onExecutar}
            disabled={!regra.ativa}
            title={regra.ativa ? "Gera o job do dia sem esperar o horário" : "Ative a regra para executar"}
            className={`flex-1 ${BOTAO_SECUNDARIO}`}
          >
            Executar agora
          </button>
          <button onClick={onExcluir} className="px-4 py-2.5 rounded-xl font-semibold text-sm bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors">
            Excluir
          </button>
        </div>
      )}
    </div>
  )
}

// --- Elegíveis ----------------------------------------------------------------

function Elegiveis({ regra }: { regra: Regra }) {
  const [pagina, setPagina] = useState(0)
  const consulta = useApi<Pagina<Devedor>>(
    `/regras/${regra.id}/elegiveis?skip=${pagina * ELEGIVEIS_POR_PAGINA}&limit=${ELEGIVEIS_POR_PAGINA}`,
  )
  const dados = consulta.dados
  const totalPaginas = dados ? Math.max(1, Math.ceil(dados.total / ELEGIVEIS_POR_PAGINA)) : 1

  return (
    <div className="lg:col-span-7">
      <Painel
        titulo={<>Elegíveis hoje {dados && <span className="font-mono text-slate-400">({fmt.numero(dados.total)})</span>}</>}
        subtitulo={`Atraso de exatamente ${regra.dias_atraso} dias, status ativo ou comunicado, com ${fmt.NOME_CANAL[regra.canal].toLowerCase()} cadastrado e sem envio com sucesso hoje neste canal.`}
      >
        {consulta.erro && !dados ? (
          <div className="p-6"><AvisoErro mensagem={`Não foi possível carregar os elegíveis: ${consulta.erro}`} onTentarNovamente={consulta.recarregar} /></div>
        ) : !dados ? (
          <div className="px-6 py-10 flex items-center justify-center gap-2 text-sm text-slate-500"><Spinner /> Carregando...</div>
        ) : dados.itens.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm font-medium text-slate-400">
            Nenhum devedor elegível hoje para esta regra
            {!regra.ativa && " (e ela está inativa: mesmo com elegíveis, não dispararia)"}.
          </p>
        ) : (
          <div className={`overflow-x-auto transition-opacity ${consulta.carregando ? "opacity-60" : ""}`}>
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50/50">
                <tr>
                  {["Devedor", "Valor", "Vencimento", "Status"].map((h) => (
                    <th key={h} className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {dados.itens.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-800 text-[13px] max-w-[240px] truncate">{d.nome}</p>
                      <p className="font-mono text-[11px] text-slate-400 mt-0.5">{fmt.documentoMascarado(d.cpf_cnpj)}</p>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs font-bold text-slate-700">{fmt.moeda(d.valor_divida)}</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">{fmt.data(d.data_vencimento)} · D+{d.dias_atraso}</td>
                    <td className="px-6 py-4">
                      <Badge texto={fmt.STATUS_DEVEDOR[d.status].texto} classe={fmt.STATUS_DEVEDOR[d.status].classe} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {dados && dados.total > ELEGIVEIS_POR_PAGINA && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Página {pagina + 1} de {totalPaginas}</span>
            <div className="flex gap-2">
              <button onClick={() => setPagina((p) => p - 1)} disabled={pagina === 0} className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">← Anterior</button>
              <button onClick={() => setPagina((p) => p + 1)} disabled={pagina + 1 >= totalPaginas} className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">Próxima →</button>
            </div>
          </div>
        )}
      </Painel>
    </div>
  )
}

// --- Modais de ação -------------------------------------------------------------

function ModalExecutar({ regra, onFechar, onExecutado }: {
  regra: Regra
  onFechar: () => void
  onExecutado: (mensagem: string) => void
}) {
  const hoje = fmt.hojeISO()
  const minimo = fmt.somarDias(hoje, -DIAS_PARA_TRAS)
  const [dia, setDia] = useState(hoje)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const diaValido = dia >= minimo && dia <= hoje

  const executar = async () => {
    setErro(null)
    setEnviando(true)
    try {
      const r = await apiFetch<MensagemResponse>(`/regras/${regra.id}/executar`, { method: "POST", body: { dia } })
      onExecutado(r.message)
    } catch (e) {
      setErro(mensagemDe(e, "Erro inesperado ao executar a regra."))
      setEnviando(false)
    }
  }

  return (
    <Modal titulo="Executar regra agora" onFechar={onFechar} ocupado={enviando}>
      <p className="text-sm text-slate-600 mb-4">
        Gera o job de <strong>{regra.nome}</strong> sem esperar o horário agendado. Os envios saem no próximo ciclo
        (até 5 minutos), sempre dentro da janela de disparo (seg. a sex., 8h às 19h). Também serve para recuperar um
        dia perdido, até {DIAS_PARA_TRAS} dias atrás.
      </p>
      <label className="block mb-4">
        <span className="block text-xs font-bold text-slate-700 mb-1.5">Dia de referência</span>
        <input
          type="date"
          value={dia}
          min={minimo}
          max={hoje}
          onChange={(e) => setDia(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-black focus:ring-4 focus:ring-black/5"
        />
        {!diaValido && (
          <span className="block text-xs text-rose-600 mt-1">
            Escolha um dia entre {fmt.data(minimo)} e {fmt.data(hoje)}.
          </span>
        )}
      </label>
      {erro && <div className="mb-4"><AvisoErro mensagem={erro} /></div>}
      <div className="flex justify-end gap-2">
        <button onClick={onFechar} disabled={enviando} className={BOTAO_SECUNDARIO}>Cancelar</button>
        <button onClick={executar} disabled={enviando || !diaValido} className={BOTAO_PRIMARIO}>
          {enviando ? "Enviando..." : "Executar"}
        </button>
      </div>
    </Modal>
  )
}

function ModalExcluir({ regra, onFechar, onExcluida, onDesativar }: {
  regra: Regra
  onFechar: () => void
  onExcluida: () => void
  onDesativar: () => void
}) {
  const [excluindo, setExcluindo] = useState(false)
  const [erro, setErro] = useState<ApiError | null>(null)

  const excluir = async () => {
    setErro(null)
    setExcluindo(true)
    try {
      await apiFetch(`/regras/${regra.id}`, { method: "DELETE" })
      onExcluida()
    } catch (e) {
      setErro(e instanceof ApiError ? e : new ApiError(0, "Erro inesperado ao excluir a regra."))
      setExcluindo(false)
    }
  }

  // 409: a regra já gerou disparos e faz parte do histórico
  const temHistorico = erro?.status === 409

  return (
    <Modal titulo="Excluir regra?" onFechar={onFechar} ocupado={excluindo}>
      <p className="text-sm text-slate-600 mb-4">
        A regra <strong>{regra.nome}</strong> será apagada. Regras que já executaram disparos não podem ser excluídas
        (fazem parte do histórico); nesse caso, desative-a.
      </p>
      {erro && <div className="mb-4"><AvisoErro mensagem={erro.message} /></div>}
      <div className="flex justify-end gap-2">
        <button onClick={onFechar} disabled={excluindo} className={BOTAO_SECUNDARIO}>Cancelar</button>
        {temHistorico ? (
          regra.ativa && <button onClick={onDesativar} className={BOTAO_PRIMARIO}>Desativar regra</button>
        ) : (
          <button onClick={excluir} disabled={excluindo} className={BOTAO_PERIGO}>
            {excluindo ? "Excluindo..." : "Excluir"}
          </button>
        )}
      </div>
    </Modal>
  )
}
