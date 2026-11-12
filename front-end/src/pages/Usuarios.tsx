import { useState } from "react"
import { useAuth } from "../auth/AuthContext"
import { NOME_PERFIL, PERFIS_POR_ACAO } from "../auth/permissoes"
import { ConfirmarAcaoUsuario, DESCRICAO_PERFIL, FormUsuario, RedefinirSenha } from "../components/ModaisUsuario"
import { AvisoErro, Spinner } from "../components/ui"
import { useApi } from "../hooks/useApi"
import { useDebounce } from "../hooks/useDebounce"
import { ApiError, apiFetch } from "../lib/api"
import * as fmt from "../lib/formatos"
import type { Pagina, Perfil, UsuarioGerenciado } from "../lib/tipos"

const POR_PAGINA = 50
const BUSCA_MINIMA = 2
const PERFIS: Perfil[] = ["administrador", "gestor", "operador"]

const ESTILO_PERFIL: Record<Perfil, { badge: string; avatar: string }> = {
  administrador: { badge: "bg-rose-50 text-rose-700 border-rose-200", avatar: "bg-rose-100/80 text-rose-700" },
  gestor: { badge: "bg-violet-50 text-violet-700 border-violet-200", avatar: "bg-violet-100/80 text-violet-700" },
  operador: { badge: "bg-blue-50 text-blue-700 border-blue-200", avatar: "bg-blue-100/80 text-blue-700" },
}

const SELECT =
  "px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black shadow-sm shadow-slate-200/50 cursor-pointer"

type Modal =
  | { tipo: "novo" }
  | { tipo: "editar" | "senha" | "desativar" | "excluir"; usuario: UsuarioGerenciado }
  | null

function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/).filter(Boolean)
  if (p.length === 0) return "?"
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase()
}

export default function Usuarios() {
  const { usuario: logado, pode } = useAuth()
  const ehAdmin = pode(PERFIS_POR_ACAO.administrarUsuarios)

  const [busca, setBusca] = useState("")
  const [perfil, setPerfil] = useState<Perfil | "">("")
  const [situacao, setSituacao] = useState<"" | "true" | "false">("")
  const [pagina, setPagina] = useState(0)
  const [modal, setModal] = useState<Modal>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [erroAcao, setErroAcao] = useState<string | null>(null)
  const [ativandoId, setAtivandoId] = useState<string | null>(null)

  const buscaAtrasada = useDebounce(busca.trim(), 400)
  const query = new URLSearchParams({ skip: String(pagina * POR_PAGINA), limit: String(POR_PAGINA) })
  if (buscaAtrasada.length >= BUSCA_MINIMA) query.set("busca", buscaAtrasada)
  if (perfil) query.set("perfil", perfil)
  if (situacao) query.set("ativo", situacao)

  const consulta = useApi<Pagina<UsuarioGerenciado>>(`/usuarios/?${query}`)
  const dados = consulta.dados
  const totalPaginas = dados ? Math.max(1, Math.ceil(dados.total / POR_PAGINA)) : 1
  const filtrando = Boolean(buscaAtrasada.length >= BUSCA_MINIMA || perfil || situacao)

  const concluir = (msg: string) => {
    setModal(null)
    setErroAcao(null)
    setAviso(msg)
    consulta.recarregar()
  }

  const ativar = async (u: UsuarioGerenciado) => {
    setAviso(null)
    setErroAcao(null)
    setAtivandoId(u.id)
    try {
      await apiFetch(`/usuarios/${u.id}/ativar`, { method: "POST" })
      concluir(`${u.nome} foi reativado.`)
    } catch (e) {
      setErroAcao(e instanceof ApiError ? e.message : "Erro inesperado ao ativar o usuário.")
    } finally {
      setAtivandoId(null)
    }
  }

  return (
    <div className="p-4 md:p-6 xl:p-8 overflow-y-auto h-full bg-slate-50 font-sans space-y-6">

      {/* --- HEADER --- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Gestão de Usuários
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            {ehAdmin
              ? "Crie usuários, defina perfis de acesso e controle quem pode entrar na plataforma."
              : "Como gestor, você vê e gerencia apenas os usuários com perfil operador."}
          </p>
        </div>
        <button
          onClick={() => setModal({ tipo: "novo" })}
          className="self-start sm:self-auto px-5 py-2.5 rounded-xl bg-black hover:bg-slate-800 active:bg-slate-900 text-white text-sm font-bold shadow-xl shadow-black/10 transition-all flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          {ehAdmin ? "Novo usuário" : "Novo operador"}
        </button>
      </div>

      {/* --- PERFIS --- */}
      {ehAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PERFIS.map((p) => (
            <div key={p} className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm shadow-slate-200/50">
              <span className={`inline-block mb-3 px-2.5 py-1 rounded-md text-[10px] font-bold font-mono tracking-wider uppercase border ${ESTILO_PERFIL[p].badge}`}>
                {NOME_PERFIL[p]}
              </span>
              <p className="text-xs font-medium text-slate-500 leading-relaxed">{DESCRICAO_PERFIL[p]}</p>
            </div>
          ))}
        </div>
      )}

      {aviso && (
        <div className="flex items-center justify-between gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl" role="status">
          <p className="text-sm font-semibold text-emerald-700">{aviso}</p>
          <button onClick={() => setAviso(null)} className="text-xs font-bold text-emerald-700 hover:underline">Fechar</button>
        </div>
      )}
      {erroAcao && <AvisoErro mensagem={erroAcao} />}

      {/* --- FILTROS --- */}
      <div className="flex flex-wrap items-start gap-3">
        <div className="w-full sm:w-80">
          <input
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setPagina(0) }}
            placeholder="Buscar por nome ou e-mail…"
            aria-label="Buscar por nome ou e-mail"
            className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black shadow-sm shadow-slate-200/50 placeholder:text-slate-400"
          />
          {buscaAtrasada.length > 0 && buscaAtrasada.length < BUSCA_MINIMA && (
            <p className="text-xs text-slate-400 mt-1 ml-1">Digite pelo menos {BUSCA_MINIMA} caracteres.</p>
          )}
        </div>
        {ehAdmin && (
          <select value={perfil} onChange={(e) => { setPerfil(e.target.value as Perfil | ""); setPagina(0) }} aria-label="Filtrar por perfil" className={SELECT}>
            <option value="">Todos os perfis</option>
            {PERFIS.map((p) => <option key={p} value={p}>{NOME_PERFIL[p]}</option>)}
          </select>
        )}
        <select value={situacao} onChange={(e) => { setSituacao(e.target.value as "" | "true" | "false"); setPagina(0) }} aria-label="Filtrar por situação" className={SELECT}>
          <option value="">Ativos e inativos</option>
          <option value="true">Só ativos</option>
          <option value="false">Só inativos</option>
        </select>
      </div>

      {consulta.erro && (
        <AvisoErro mensagem={`Não foi possível carregar os usuários: ${consulta.erro}`} onTentarNovamente={consulta.recarregar} />
      )}

      {/* --- TABELA --- */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm shadow-slate-200/50 overflow-hidden">
        {!dados && consulta.carregando ? (
          <div className="py-16 flex justify-center gap-2 text-sm text-slate-500"><Spinner /> Carregando usuários...</div>
        ) : dados && dados.itens.length === 0 ? (
          <p className="py-16 text-center text-sm font-medium text-slate-500">
            {filtrando ? "Nenhum usuário encontrado com os filtros aplicados." : ehAdmin ? "Nenhum usuário cadastrado." : "Nenhum operador cadastrado ainda."}
          </p>
        ) : dados ? (
          <div className={`overflow-x-auto transition-opacity ${consulta.carregando ? "opacity-60" : ""}`}>
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50/50">
                <tr>
                  {["Nome", "E-mail", "Perfil", "Situação", "Criado em", "Ações"].map((h) => (
                    <th key={h} className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {dados.itens.map((u) => {
                  const proprio = u.id === logado?.id
                  return (
                    <tr key={u.id} className={`hover:bg-slate-50/80 transition-colors ${!u.ativo ? "opacity-60" : ""}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${ESTILO_PERFIL[u.perfil].avatar}`}>
                            {iniciais(u.nome)}
                          </div>
                          <span className="text-slate-900 font-bold text-[13px] tracking-tight max-w-[220px] truncate" title={u.nome}>{u.nome}</span>
                          {proprio && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">você</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-[11px] font-medium text-slate-500">{u.email}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold font-mono tracking-wider uppercase border ${ESTILO_PERFIL[u.perfil].badge}`}>
                          {NOME_PERFIL[u.perfil]}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold font-mono tracking-widest uppercase border ${
                          u.ativo ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-500 border-slate-200"
                        }`}>
                          {u.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">{fmt.dataHora(u.criado_em)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <BotaoAcao onClick={() => setModal({ tipo: "editar", usuario: u })}>Editar</BotaoAcao>
                          {!proprio && (
                            <>
                              <BotaoAcao onClick={() => setModal({ tipo: "senha", usuario: u })}>Redefinir senha</BotaoAcao>
                              {u.ativo ? (
                                <BotaoAcao perigo onClick={() => setModal({ tipo: "desativar", usuario: u })}>Desativar</BotaoAcao>
                              ) : (
                                <BotaoAcao onClick={() => void ativar(u)} disabled={ativandoId === u.id}>
                                  {ativandoId === u.id ? "Ativando..." : "Reativar"}
                                </BotaoAcao>
                              )}
                              {ehAdmin && <BotaoAcao perigo onClick={() => setModal({ tipo: "excluir", usuario: u })}>Excluir</BotaoAcao>}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {dados && dados.total > POR_PAGINA && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Página {pagina + 1} de {totalPaginas} · {fmt.numero(dados.total)} usuários</span>
            <div className="flex gap-2">
              <button onClick={() => setPagina((p) => p - 1)} disabled={pagina === 0} className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">← Anterior</button>
              <button onClick={() => setPagina((p) => p + 1)} disabled={pagina + 1 >= totalPaginas} className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">Próxima →</button>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400">
        Para trocar a sua própria senha, use <strong>Minha conta</strong>, no rodapé do menu lateral.
      </p>

      {/* --- MODAIS --- */}
      {modal?.tipo === "novo" && (
        <FormUsuario onFechar={() => setModal(null)} onSalvo={(u) => concluir(`Usuário ${u.nome} criado como ${NOME_PERFIL[u.perfil].toLowerCase()}.`)} />
      )}
      {modal?.tipo === "editar" && (
        <FormUsuario usuario={modal.usuario} onFechar={() => setModal(null)} onSalvo={(u) => concluir(`Dados de ${u.nome} atualizados.`)} />
      )}
      {modal?.tipo === "senha" && (
        <RedefinirSenha usuario={modal.usuario} onFechar={() => setModal(null)} onFeito={concluir} />
      )}
      {(modal?.tipo === "desativar" || modal?.tipo === "excluir") && (
        <ConfirmarAcaoUsuario
          key={`${modal.tipo}-${modal.usuario.id}`}
          usuario={modal.usuario}
          acao={modal.tipo}
          onFechar={() => setModal(null)}
          onFeito={concluir}
          onDesativarEmVez={() => setModal({ tipo: "desativar", usuario: modal.usuario })}
        />
      )}
    </div>
  )
}

function BotaoAcao({ children, onClick, perigo = false, disabled = false }: {
  children: React.ReactNode
  onClick: () => void
  perigo?: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-2.5 py-1.5 rounded-lg bg-white border text-xs font-bold transition-colors disabled:opacity-50 ${
        perigo ? "border-rose-200 text-rose-600 hover:bg-rose-50" : "border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-black"
      }`}
    >
      {children}
    </button>
  )
}
