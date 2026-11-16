import { useState } from "react"
import { useAuth } from "../auth/AuthContext"
import { PERFIS_POR_ACAO } from "../auth/permissoes"
import EditorRegra, { TemplateDestacado } from "../components/EditorRegra"
import { CONTEUDO, ID, inputClasse, PAGINA, SUPERFICIE, TABELA, TBODY, TD, TD_NUM, TH, TH_NUM, THEAD } from "../components/estilos"
import {
  AcoesModal,
  Aviso,
  AvisoErro,
  BOTAO_PERIGO,
  BOTAO_PERIGO_SECUNDARIO,
  BOTAO_PRIMARIO,
  BOTAO_SECUNDARIO,
  Badge,
  CabecalhoPagina,
  CampoForm,
  Contagem,
  EsqueletoTabela,
  Modal,
  Paginacao,
  Painel,
  Spinner,
  Vazio,
} from "../components/ui"
import { useApi } from "../hooks/useApi"
import { ApiError, apiFetch } from "../lib/api"
import * as fmt from "../lib/formatos"
import { DIAS_PARA_TRAS } from "../lib/regua"
import type { Canal, Devedor, MensagemResponse, Pagina, Regra, StatusRegua } from "../lib/tipos"

const CANAIS: Canal[] = ["email", "sms", "whatsapp"]
const ELEGIVEIS_POR_PAGINA = 20

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
    <div className={PAGINA}>
      <div className={CONTEUDO}>
        <CabecalhoPagina
          titulo="Régua de cobrança"
          descricao="Cada regra envia uma mensagem por um canal quando o atraso do devedor chega ao prazo definido."
          acoes={
            podeGerenciar && (
              <button onClick={() => setEditor({ modo: "novo" })} className={BOTAO_PRIMARIO}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7H5" />
                </svg>
                Nova regra
              </button>
            )
          }
        />

        {aviso && <Aviso tipo="sucesso" onFechar={() => setAviso(null)}>{aviso}</Aviso>}
        {erroAcao && <AvisoErro mensagem={erroAcao} />}
        {lista.erro && !lista.dados && (
          <AvisoErro mensagem={`Não foi possível carregar as regras: ${lista.erro}`} onTentarNovamente={recarregar} />
        )}
        {!podeGerenciar && (
          <Aviso tipo="info">
            Você pode consultar as regras e os devedores elegíveis. Criar, editar e ativar regras é permitido ao gestor e ao administrador.
          </Aviso>
        )}

        {/* --- RÉGUA VISUAL --- */}
        <section className={`${SUPERFICIE} overflow-hidden`}>
          <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-950">Linha do tempo da cobrança</h2>
              {status.dados ? (
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-slate-500" role="status">
                  <span className={`inline-flex items-center gap-1.5 font-medium ${status.dados.regua_ativa ? "text-slate-800" : "text-amber-800"}`}>
                    <span className={`w-2 h-2 rounded-full ${status.dados.regua_ativa ? "bg-emerald-500" : "bg-amber-500"}`} aria-hidden="true" />
                    {status.dados.mensagem}
                  </span>
                  <span>{status.dados.regras_ativas} de {status.dados.total_regras} regras ativas.</span>
                </p>
              ) : (
                <p className="mt-0.5 text-[13px] text-slate-500">Em que dia de atraso cada canal é acionado.</p>
              )}
            </div>

            <div className="inline-flex h-9 p-1 rounded-lg bg-slate-100 self-start md:self-auto" role="group" aria-label="Filtrar por canal">
              {(["", ...CANAIS] as const).map((c) => (
                <button
                  key={c || "todos"}
                  onClick={() => setFiltroCanal(c)}
                  aria-pressed={filtroCanal === c}
                  className={`px-3 rounded-md text-[13px] font-medium transition-colors ${
                    filtroCanal === c ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-950"
                  }`}
                >
                  {c ? fmt.NOME_CANAL[c] : "Todos"}
                </button>
              ))}
            </div>
          </div>

          {!lista.dados && lista.carregando ? (
            <div className="h-48 animate-pulse bg-slate-50" role="status" aria-label="Carregando regras" />
          ) : lista.dados && regras.length === 0 ? (
            <Vazio
              titulo={filtroCanal ? `Nenhuma regra de ${fmt.NOME_CANAL[filtroCanal]}` : "Nenhuma regra cadastrada"}
              descricao={podeGerenciar ? "Crie uma regra para começar a cobrança automática." : "Peça a um gestor para cadastrar as regras da régua."}
              acao={podeGerenciar && <button onClick={() => setEditor({ modo: "novo" })} className={BOTAO_PRIMARIO}>Nova regra</button>}
            />
          ) : (
            <ReguaVisual
              regras={regras}
              canais={filtroCanal ? [filtroCanal] : CANAIS}
              selecionadaId={selecionada?.id ?? null}
              onSelecionar={setSelecionadaId}
            />
          )}
        </section>

        {/* --- CARDS --- */}
        {regras.length > 0 && (
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
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
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
    </div>
  )
}

// --- Régua visual -----------------------------------------------------------------

// Marcas da escala. A escala é comprimida (raiz quadrada): os primeiros dias, onde
// costumam ficar mais regras, ganham mais espaço que D+60 a D+365.
const MARCAS = [0, 1, 5, 15, 30, 60, 90, 180, 365]
const FINS = [30, 60, 90, 180, 365]

function posicao(dias: number, fim: number): string {
  return `${(Math.sqrt(dias) / Math.sqrt(fim)) * 100}%`
}

/** Uma faixa por canal; cada regra é uma marca no seu dia de atraso (cheia = ativa). */
function ReguaVisual({ regras, canais, selecionadaId, onSelecionar }: {
  regras: Regra[]
  canais: Canal[]
  selecionadaId: string | null
  onSelecionar: (id: string) => void
}) {
  const maior = Math.max(0, ...regras.map((r) => r.dias_atraso))
  const fim = FINS.find((f) => f >= maior) ?? FINS[FINS.length - 1]
  const marcas = MARCAS.filter((m) => m <= fim)

  return (
    <div className="px-5 sm:px-6 pt-5 pb-4 overflow-x-auto">
      <div className="min-w-[560px]">
        {canais.map((canal) => {
          const doCanal = regras.filter((r) => r.canal === canal).sort((a, b) => a.dias_atraso - b.dias_atraso)
          return (
            <div key={canal} className="flex items-center gap-4 h-14 border-b border-dashed border-slate-200">
              <span className="w-20 flex-shrink-0 text-[13px] font-medium text-slate-700">{fmt.NOME_CANAL[canal]}</span>
              <div className="relative flex-1 h-full mr-3">
                <span className="absolute inset-x-0 top-1/2 h-px bg-slate-200" aria-hidden="true" />
                {doCanal.length === 0 && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 bg-white pr-2 text-xs text-slate-400">Sem regras</span>
                )}
                {doCanal.map((r) => {
                  const ativa = selecionadaId === r.id
                  return (
                    <button
                      key={r.id}
                      onClick={() => onSelecionar(r.id)}
                      title={`${r.nome}: D+${r.dias_atraso}, ${r.ativa ? "ativa" : "inativa"}`}
                      aria-label={`${r.nome}, D+${r.dias_atraso}, ${r.ativa ? "ativa" : "inativa"}`}
                      aria-pressed={ativa}
                      className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                      style={{ left: posicao(r.dias_atraso, fim) }}
                    >
                      <span
                        className={`block w-3.5 h-3.5 rounded-full border-2 transition-transform group-hover:scale-125 ${
                          r.ativa ? "bg-tinta border-tinta" : "bg-white border-slate-400"
                        } ${ativa ? "ring-4 ring-slate-900/15 scale-125" : ""}`}
                      />
                      <span
                        className={`absolute top-full mt-1 text-[11px] whitespace-nowrap ${
                          ativa ? "font-semibold text-slate-950" : "text-slate-500"
                        }`}
                      >
                        D+{r.dias_atraso}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Escala */}
        <div className="flex gap-4 pt-2">
          <span className="w-20 flex-shrink-0 text-xs text-slate-400">Atraso</span>
          <div className="relative flex-1 h-5 mr-3">
            {marcas.map((m) => (
              <span
                key={m}
                className="absolute top-0 -translate-x-1/2 text-xs text-slate-400 before:block before:mx-auto before:w-px before:h-1.5 before:bg-slate-300"
                style={{ left: posicao(m, fim) }}
              >
                {m === 0 ? "Venc." : `D+${m}`}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-tinta" aria-hidden="true" />Ativa</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border-2 border-slate-400" aria-hidden="true" />Inativa</span>
          <span>Clique em uma marca para ver a regra e os elegíveis de hoje.</span>
        </div>
      </div>
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
  return (
    <div
      onClick={onSelecionar}
      onKeyDown={(e) => { if (e.key === "Enter") onSelecionar() }}
      tabIndex={0}
      role="button"
      aria-pressed={selecionada}
      className={`rounded-xl p-5 cursor-pointer transition-[border-color,box-shadow] border bg-white ${
        selecionada ? "border-tinta ring-1 ring-tinta" : "border-slate-200 hover:border-slate-400"
      }`}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="inline-flex items-center h-6 px-2 rounded-md bg-slate-100 text-xs font-medium text-slate-700">
          {fmt.NOME_CANAL[regra.canal]}
        </span>
        {podeAlternar ? (
          <span className="flex items-center gap-2">
            <span className={`text-xs ${regra.ativa ? "text-slate-800 font-medium" : "text-slate-500"}`}>{regra.ativa ? "Ativa" : "Inativa"}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onAlternar() }}
              onKeyDown={(e) => e.stopPropagation()}
              disabled={alternando}
              role="switch"
              aria-checked={regra.ativa}
              aria-label={regra.ativa ? "Desativar regra" : "Ativar regra"}
              title={regra.ativa ? "Desativar regra" : "Ativar regra"}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-wait ${
                regra.ativa ? "bg-emerald-600" : "bg-slate-300"
              }`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${regra.ativa ? "translate-x-[18px]" : "translate-x-0.5"}`} />
            </button>
          </span>
        ) : (
          <Badge texto={regra.ativa ? "Ativa" : "Inativa"} classe={regra.ativa ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"} />
        )}
      </div>

      <p className="font-medium text-slate-950 text-sm line-clamp-1" title={regra.nome}>{regra.nome}</p>
      <p className="mt-1 text-[13px] text-slate-500">
        <span className="font-medium text-slate-800">D+{regra.dias_atraso}</span>, a partir das {fmt.horario(regra.horario_disparo)}
      </p>
      <p className="mt-3 pt-3 border-t border-slate-100 text-[13px] text-slate-500 line-clamp-2">{regra.template_mensagem}</p>
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
  const campos = [
    { rotulo: "Canal", valor: fmt.NOME_CANAL[regra.canal] },
    { rotulo: "Prazo", valor: `D+${regra.dias_atraso} (dias após o vencimento)` },
    { rotulo: "Horário", valor: `A partir das ${fmt.horario(regra.horario_disparo)}, de segunda a sexta` },
    { rotulo: "Situação", valor: regra.ativa ? "Ativa, disparando" : "Inativa, não dispara" },
    { rotulo: "Criada em", valor: fmt.dataHora(regra.criado_em) },
  ]

  return (
    <section className={`xl:col-span-5 ${SUPERFICIE} p-5 sm:p-6 flex flex-col`}>
      <div className="flex items-start justify-between gap-3 mb-5">
        <h2 className="text-base font-semibold text-slate-950 break-words">{regra.nome}</h2>
        <Badge texto={regra.ativa ? "Ativa" : "Inativa"} classe={regra.ativa ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"} />
      </div>

      <dl className="mb-6 divide-y divide-slate-100 border-y border-slate-100">
        {campos.map((c) => (
          <div key={c.rotulo} className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="text-[13px] text-slate-500">{c.rotulo}</dt>
            <dd className="text-[13px] font-medium text-right text-slate-950">{c.valor}</dd>
          </div>
        ))}
      </dl>

      <div className="flex-1">
        <p className="text-[13px] font-medium text-slate-700 mb-2">Template da mensagem</p>
        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-[13px] text-slate-800 leading-relaxed max-h-56 overflow-y-auto whitespace-pre-wrap break-words">
          <TemplateDestacado template={regra.template_mensagem} />
        </div>
      </div>

      {podeGerenciar && (
        <div className="flex flex-wrap gap-2 mt-6 pt-5 border-t border-slate-200">
          <button onClick={onEditar} className={`flex-1 ${BOTAO_SECUNDARIO}`}>Editar</button>
          <button
            onClick={onExecutar}
            disabled={!regra.ativa}
            title={regra.ativa ? "Gera o job do dia sem esperar o horário" : "Ative a regra para executar"}
            className={`flex-1 ${BOTAO_SECUNDARIO}`}
          >
            Executar agora
          </button>
          <button onClick={onExcluir} className={BOTAO_PERIGO_SECUNDARIO}>
            Excluir
          </button>
        </div>
      )}
    </section>
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
    <div className="xl:col-span-7">
      <Painel
        titulo={<>Elegíveis hoje {dados && <Contagem valor={fmt.numero(dados.total)} />}</>}
        subtitulo={`Atraso de exatamente ${regra.dias_atraso} dias, status ativo ou comunicado, com ${fmt.NOME_CANAL[regra.canal].toLowerCase()} cadastrado e sem envio com sucesso hoje neste canal.`}
      >
        {consulta.erro && !dados ? (
          <div className="p-5 sm:px-6"><AvisoErro mensagem={`Não foi possível carregar os elegíveis: ${consulta.erro}`} onTentarNovamente={consulta.recarregar} /></div>
        ) : !dados ? (
          <EsqueletoTabela linhas={4} rotulo="Carregando elegíveis" />
        ) : dados.itens.length === 0 ? (
          <Vazio
            titulo="Nenhum devedor elegível hoje"
            descricao={regra.ativa ? "Ninguém está exatamente neste dia de atraso com contato para o canal." : "E a regra está inativa: mesmo com elegíveis, ela não dispararia."}
          />
        ) : (
          <div className={`overflow-x-auto transition-opacity ${consulta.carregando ? "opacity-60" : ""}`}>
            <table className={TABELA}>
              <thead className={THEAD}>
                <tr>
                  <th className={TH}>Devedor</th>
                  <th className={TH_NUM}>Valor</th>
                  <th className={TH}>Vencimento</th>
                  <th className={TH}>Status</th>
                </tr>
              </thead>
              <tbody className={TBODY}>
                {dados.itens.map((d) => (
                  <tr key={d.id}>
                    <td className={TD}>
                      <p className="font-medium text-slate-950 max-w-[240px] truncate">{d.nome}</p>
                      <p className={`${ID} mt-0.5`}>{fmt.documentoMascarado(d.cpf_cnpj)}</p>
                    </td>
                    <td className={`${TD_NUM} font-medium text-slate-950`}>{fmt.moeda(d.valor_divida)}</td>
                    <td className={TD}>
                      <span className="text-slate-500">{fmt.data(d.data_vencimento)}</span>{" "}
                      <span className={`ml-1 font-medium ${fmt.corAtraso(d.dias_atraso)}`}>D+{d.dias_atraso}</span>
                    </td>
                    <td className={TD}>
                      <Badge texto={fmt.STATUS_DEVEDOR[d.status].texto} classe={fmt.STATUS_DEVEDOR[d.status].classe} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {dados && dados.total > ELEGIVEIS_POR_PAGINA && (
          <Paginacao
            inicio={fmt.numero(pagina * ELEGIVEIS_POR_PAGINA + 1)}
            fim={fmt.numero(pagina * ELEGIVEIS_POR_PAGINA + dados.itens.length)}
            total={fmt.numero(dados.total)}
            pagina={pagina}
            totalPaginas={totalPaginas}
            onAnterior={() => setPagina((p) => p - 1)}
            onProxima={() => setPagina((p) => p + 1)}
          />
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
      <p className="mb-5">
        Gera o job de <strong className="font-medium text-slate-950">{regra.nome}</strong> sem esperar o horário agendado.
        Os envios saem no próximo ciclo (até 5 minutos), sempre dentro da janela de disparo (segunda a sexta, das 8h às 19h55).
        Também serve para recuperar um dia perdido, até {DIAS_PARA_TRAS} dias atrás.
      </p>
      <CampoForm
        rotulo="Dia de referência"
        erro={diaValido ? null : `Escolha um dia entre ${fmt.data(minimo)} e ${fmt.data(hoje)}.`}
      >
        <input
          type="date"
          value={dia}
          min={minimo}
          max={hoje}
          onChange={(e) => setDia(e.target.value)}
          className={inputClasse(diaValido ? null : "x")}
        />
      </CampoForm>
      {erro && <div className="mt-4"><AvisoErro mensagem={erro} /></div>}
      <AcoesModal>
        <button onClick={onFechar} disabled={enviando} className={BOTAO_SECUNDARIO}>Cancelar</button>
        <button onClick={executar} disabled={enviando || !diaValido} className={BOTAO_PRIMARIO}>
          {enviando && <Spinner />}
          {enviando ? "Enviando..." : "Executar"}
        </button>
      </AcoesModal>
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
      <p>
        A regra <strong className="font-medium text-slate-950">{regra.nome}</strong> será apagada. Regras que já executaram
        disparos não podem ser excluídas (fazem parte do histórico); nesse caso, desative-a.
      </p>
      {erro && <div className="mt-4"><AvisoErro mensagem={erro.message} /></div>}
      <AcoesModal>
        <button onClick={onFechar} disabled={excluindo} className={BOTAO_SECUNDARIO}>Cancelar</button>
        {temHistorico ? (
          regra.ativa && <button onClick={onDesativar} className={BOTAO_PRIMARIO}>Desativar regra</button>
        ) : (
          <button onClick={excluir} disabled={excluindo} className={BOTAO_PERIGO}>
            {excluindo && <Spinner />}
            {excluindo ? "Excluindo..." : "Excluir"}
          </button>
        )}
      </AcoesModal>
    </Modal>
  )
}
