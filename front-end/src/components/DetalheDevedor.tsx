// Painel lateral com os dados de um devedor, troca de status, histórico de
// comunicações e exclusão (LGPD). As permissões espelham o back-end:
// quitar = gestor/administrador; excluir = administrador; quitado não reabre.

import { useState, type ReactNode } from "react"
import { useAuth } from "../auth/AuthContext"
import { PERFIS_POR_ACAO } from "../auth/permissoes"
import { useApi } from "../hooks/useApi"
import { ApiError, apiFetch } from "../lib/api"
import * as fmt from "../lib/formatos"
import type { Comunicacao, Devedor, StatusDevedor } from "../lib/tipos"
import {
  AvisoErro,
  BOTAO_PERIGO,
  BOTAO_PRIMARIO,
  BOTAO_SECUNDARIO,
  Badge,
  Modal,
  Spinner,
} from "./ui"
import { useFecharComEsc } from "../hooks/useFecharComEsc"

const STATUS: StatusDevedor[] = ["ativo", "comunicado", "negociando", "quitado", "inativo"]
const PASSO_HISTORICO = 50
const MAXIMO_HISTORICO = 200 // limite da API

interface DetalheDevedorProps {
  devedorId: string
  onFechar: () => void
  /** Status mudou: a lista deve recarregar. */
  onAlterado: () => void
  /** Devedor excluído: fechar o painel e recarregar a lista. */
  onExcluido: (nome: string) => void
  onAbrirLote?: (loteId: string) => void
}

function mensagem(e: unknown, padrao: string): string {
  return e instanceof ApiError ? e.message : padrao
}

export default function DetalheDevedor({ devedorId, onFechar, onAlterado, onExcluido, onAbrirLote }: DetalheDevedorProps) {
  const detalhe = useApi<Devedor>(`/devedores/${devedorId}`)
  const devedor = detalhe.dados
  const [modalAberto, setModalAberto] = useState(false)
  useFecharComEsc(onFechar, !modalAberto)

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onFechar} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Detalhe do devedor"
        className="relative w-full max-w-xl h-full bg-slate-50 shadow-2xl flex flex-col"
      >
        {/* Cabeçalho */}
        <div className="px-6 py-5 bg-white border-b border-slate-200 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Devedor</p>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight truncate">{devedor?.nome ?? "Carregando..."}</h2>
            {devedor && (
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="font-mono text-xs text-slate-500">
                  {devedor.cpf_cnpj.length === 14 ? "CNPJ" : "CPF"} {fmt.documento(devedor.cpf_cnpj)}
                </span>
                <Badge texto={fmt.STATUS_DEVEDOR[devedor.status].texto} classe={fmt.STATUS_DEVEDOR[devedor.status].classe} />
              </div>
            )}
          </div>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="p-2 -mr-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {detalhe.erro && !devedor ? (
            <AvisoErro mensagem={`Não foi possível carregar o devedor: ${detalhe.erro}`} onTentarNovamente={detalhe.recarregar} />
          ) : !devedor ? (
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <Spinner /> Carregando...
            </div>
          ) : (
            <>
              <Dados devedor={devedor} onAbrirLote={onAbrirLote} />
              <AlterarStatus
                devedor={devedor}
                onModal={setModalAberto}
                onAlterado={() => {
                  detalhe.recarregar()
                  onAlterado()
                }}
              />
              <Historico devedorId={devedor.id} />
              <ZonaExclusao devedor={devedor} onModal={setModalAberto} onExcluido={() => onExcluido(devedor.nome)} />
            </>
          )}
        </div>
      </aside>
    </div>
  )
}

// --- Seções -------------------------------------------------------------------

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200/60 shadow-sm shadow-slate-200/50 p-5">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">{titulo}</h3>
      {children}
    </section>
  )
}

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{rotulo}</dt>
      <dd className="text-sm font-medium text-slate-900 mt-0.5 break-words">{children}</dd>
    </div>
  )
}

function Dados({ devedor, onAbrirLote }: { devedor: Devedor; onAbrirLote?: (id: string) => void }) {
  return (
    <Secao titulo="Dívida e contato">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
        <Campo rotulo="Valor da dívida">
          <span className="text-lg font-bold">{fmt.moeda(devedor.valor_divida)}</span>
        </Campo>
        <Campo rotulo="Vencimento">
          {fmt.data(devedor.data_vencimento)}{" "}
          <span className={`font-mono text-xs font-bold ${fmt.corAtraso(devedor.dias_atraso)}`}>D+{devedor.dias_atraso}</span>
        </Campo>
        <Campo rotulo="E-mail">{devedor.email ?? "—"}</Campo>
        <Campo rotulo="Telefone (SMS)">{fmt.telefone(devedor.telefone)}</Campo>
        <Campo rotulo="WhatsApp">{fmt.telefone(devedor.whatsapp)}</Campo>
        <Campo rotulo="Importado em">{fmt.dataHora(devedor.criado_em)}</Campo>
      </dl>
      {onAbrirLote && (
        <button
          onClick={() => onAbrirLote(devedor.lote_id)}
          className="mt-4 text-xs font-bold text-slate-600 hover:text-black underline underline-offset-2"
        >
          Ver lote de origem →
        </button>
      )}
    </Secao>
  )
}

function AlterarStatus({ devedor, onModal, onAlterado }: {
  devedor: Devedor
  onModal: (aberto: boolean) => void
  onAlterado: () => void
}) {
  const { pode } = useAuth()
  const podeQuitar = pode(PERFIS_POR_ACAO.quitarDevedor)
  const opcoes = STATUS.filter((s) => s !== devedor.status && (s !== "quitado" || podeQuitar))
  const [novo, setNovo] = useState<StatusDevedor | "">("")
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmarQuitado, setConfirmarQuitado] = useState(false)

  if (devedor.status === "quitado") {
    return (
      <Secao titulo="Situação da cobrança">
        <p className="text-sm text-slate-600">
          Devedor <strong>quitado</strong>: a cobrança foi encerrada e não pode ser reaberta.
        </p>
      </Secao>
    )
  }

  const aplicar = async () => {
    if (!novo) return
    setErro(null)
    setSalvando(true)
    try {
      await apiFetch<Devedor>(`/devedores/${devedor.id}/status`, { method: "PATCH", body: { status: novo } })
      setNovo("")
      fecharConfirmacao()
      onAlterado()
    } catch (e) {
      setErro(mensagem(e, "Erro inesperado ao alterar o status."))
      fecharConfirmacao()
    } finally {
      setSalvando(false)
    }
  }

  const abrirConfirmacao = () => {
    setConfirmarQuitado(true)
    onModal(true)
  }
  const fecharConfirmacao = () => {
    setConfirmarQuitado(false)
    onModal(false)
  }

  return (
    <Secao titulo="Situação da cobrança">
      <p className="text-sm text-slate-600 mb-4">
        Atual: <strong>{fmt.STATUS_DEVEDOR[devedor.status].texto}</strong> — {fmt.STATUS_DEVEDOR[devedor.status].descricao}
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={novo}
          onChange={(e) => setNovo(e.target.value as StatusDevedor | "")}
          aria-label="Novo status"
          className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-900 outline-none focus:border-black focus:ring-4 focus:ring-black/5"
        >
          <option value="">Alterar para...</option>
          {opcoes.map((s) => (
            <option key={s} value={s}>{fmt.STATUS_DEVEDOR[s].texto}</option>
          ))}
        </select>
        <button
          onClick={novo === "quitado" ? abrirConfirmacao : aplicar}
          disabled={!novo || salvando}
          className={BOTAO_PRIMARIO}
        >
          {salvando ? "Salvando..." : "Aplicar"}
        </button>
      </div>
      {novo && <p className="text-xs text-slate-500 mt-2">{fmt.STATUS_DEVEDOR[novo].descricao}</p>}
      {!podeQuitar && (
        <p className="text-xs text-slate-400 mt-2">Marcar como quitado é permitido só ao gestor e ao administrador.</p>
      )}
      {erro && <div className="mt-3"><AvisoErro mensagem={erro} /></div>}

      {confirmarQuitado && (
        <Modal titulo="Marcar como quitado?" onFechar={fecharConfirmacao} ocupado={salvando}>
          <p className="text-sm text-slate-600 mb-6">
            <strong>{devedor.nome}</strong> sai da régua de cobrança e passa a contar na taxa de conversão.
            Essa ação é <strong>definitiva</strong>: um devedor quitado não pode ser reaberto.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={fecharConfirmacao} disabled={salvando} className={BOTAO_SECUNDARIO}>Cancelar</button>
            <button onClick={aplicar} disabled={salvando} className={BOTAO_PRIMARIO}>
              {salvando ? "Salvando..." : "Confirmar quitação"}
            </button>
          </div>
        </Modal>
      )}
    </Secao>
  )
}

function Historico({ devedorId }: { devedorId: string }) {
  const [limite, setLimite] = useState(PASSO_HISTORICO)
  const historico = useApi<Comunicacao[]>(`/devedores/${devedorId}/comunicacoes?limit=${limite}`)
  const lista = historico.dados ?? []
  const podeMais = lista.length === limite && limite < MAXIMO_HISTORICO

  return (
    <Secao titulo="Histórico de comunicações">
      {historico.erro && !historico.dados ? (
        <AvisoErro mensagem={`Não foi possível carregar o histórico: ${historico.erro}`} onTentarNovamente={historico.recarregar} />
      ) : !historico.dados ? (
        <div className="flex items-center gap-2 text-sm text-slate-500"><Spinner /> Carregando...</div>
      ) : lista.length === 0 ? (
        <p className="text-sm text-slate-400">Nenhuma comunicação enviada a este devedor ainda.</p>
      ) : (
        <ol className="space-y-3">
          {lista.map((c) => {
            const status = fmt.STATUS_COMUNICACAO[c.status]
            return (
              <li key={c.id} className="flex gap-3 pb-3 border-b border-slate-100 last:border-0 last:pb-0">
                <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: fmt.COR_CANAL[c.canal] }} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">{fmt.NOME_CANAL[c.canal]}</span>
                    <Badge texto={status.texto} classe={status.classe} />
                    <span className="text-xs text-slate-400">
                      {c.tentativas} {c.tentativas === 1 ? "tentativa" : "tentativas"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-mono">
                    {c.enviado_em ? `Enviado em ${fmt.dataHora(c.enviado_em)}` : `Gerado em ${fmt.dataHora(c.criado_em)}`}
                  </p>
                  {(c.mensagem_erro || c.codigo_erro) && (
                    <p className="text-xs text-rose-600 mt-1">
                      {c.codigo_erro && <span className="font-mono">[{c.codigo_erro}] </span>}
                      {c.mensagem_erro}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
      {podeMais && (
        <button
          onClick={() => setLimite((l) => Math.min(l + PASSO_HISTORICO, MAXIMO_HISTORICO))}
          className="mt-4 text-xs font-bold text-slate-600 hover:text-black"
        >
          Carregar mais
        </button>
      )}
    </Secao>
  )
}

const PALAVRA_CONFIRMACAO = "EXCLUIR"

function ZonaExclusao({ devedor, onModal, onExcluido }: {
  devedor: Devedor
  onModal: (aberto: boolean) => void
  onExcluido: () => void
}) {
  const { pode } = useAuth()
  const [aberto, setAberto] = useState(false)
  const [confirmacao, setConfirmacao] = useState("")
  const [excluindo, setExcluindo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  if (!pode(PERFIS_POR_ACAO.excluirDevedor)) return null

  const abrir = () => {
    setConfirmacao("")
    setErro(null)
    setAberto(true)
    onModal(true)
  }
  const fechar = () => {
    setAberto(false)
    onModal(false)
  }

  const excluir = async () => {
    setErro(null)
    setExcluindo(true)
    try {
      await apiFetch(`/devedores/${devedor.id}`, { method: "DELETE" })
      onModal(false)
      onExcluido()
    } catch (e) {
      setErro(mensagem(e, "Erro inesperado ao excluir."))
      setExcluindo(false)
    }
  }

  return (
    <section className="rounded-2xl border border-rose-200 bg-rose-50/40 p-5">
      <h3 className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-2">Exclusão de dados (LGPD)</h3>
      <p className="text-sm text-slate-600 mb-4">
        Atende ao pedido de exclusão do titular: apaga o devedor e todo o histórico de comunicações.
        A ação fica registrada na auditoria e não pode ser desfeita.
      </p>
      <button onClick={abrir} className={BOTAO_PERIGO}>Excluir devedor</button>

      {aberto && (
        <Modal titulo="Excluir devedor definitivamente?" onFechar={fechar} ocupado={excluindo}>
          <p className="text-sm text-slate-600 mb-4">
            Os dados de <strong>{devedor.nome}</strong> e o histórico de comunicações serão apagados.
            Para confirmar, digite <strong className="font-mono">{PALAVRA_CONFIRMACAO}</strong>:
          </p>
          <input
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            autoFocus
            aria-label={`Digite ${PALAVRA_CONFIRMACAO} para confirmar`}
            className="w-full px-3 py-2.5 mb-4 rounded-xl border border-slate-200 font-mono text-sm outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10"
          />
          {erro && <div className="mb-4"><AvisoErro mensagem={erro} /></div>}
          <div className="flex justify-end gap-2">
            <button onClick={fechar} disabled={excluindo} className={BOTAO_SECUNDARIO}>Cancelar</button>
            <button
              onClick={excluir}
              disabled={excluindo || confirmacao.trim().toUpperCase() !== PALAVRA_CONFIRMACAO}
              className={BOTAO_PERIGO}
            >
              {excluindo ? "Excluindo..." : "Excluir definitivamente"}
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}
