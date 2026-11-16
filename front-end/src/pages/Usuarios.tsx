import { useState } from "react"
import { useAuth } from "../auth/AuthContext"
import { NOME_PERFIL, PERFIS_POR_ACAO } from "../auth/permissoes"
import { ConfirmarAcaoUsuario, FormUsuario, RedefinirSenha } from "../components/ModaisUsuario"
import { CONTEUDO, inputClasse, PAGINA, SUPERFICIE, TABELA, TBODY, TD, TH, THEAD } from "../components/estilos"
import {
  Aviso,
  AvisoErro,
  Badge,
  BOTAO_FANTASMA_P,
  BOTAO_PERIGO_FANTASMA_P,
  BOTAO_PRIMARIO,
  CabecalhoPagina,
  EsqueletoTabela,
  Paginacao,
  Selecao,
  Vazio,
} from "../components/ui"
import { useApi } from "../hooks/useApi"
import { useDebounce } from "../hooks/useDebounce"
import { ApiError, apiFetch } from "../lib/api"
import * as fmt from "../lib/formatos"
import type { Pagina, Perfil, UsuarioGerenciado } from "../lib/tipos"
import { DESCRICAO_PERFIL } from "../lib/usuarios"

const POR_PAGINA = 50
const BUSCA_MINIMA = 2
const PERFIS: Perfil[] = ["administrador", "gestor", "operador"]

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
    <div className={PAGINA}>
      <div className={CONTEUDO}>
        <CabecalhoPagina
          titulo="Usuários"
          descricao={
            ehAdmin
              ? "Crie usuários, defina perfis de acesso e controle quem pode entrar na plataforma."
              : "Como gestor, você vê e gerencia apenas os usuários com perfil operador."
          }
          acoes={
            <button onClick={() => setModal({ tipo: "novo" })} className={BOTAO_PRIMARIO}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7H5" />
              </svg>
              {ehAdmin ? "Novo usuário" : "Novo operador"}
            </button>
          }
        />

        {/* --- PERFIS --- */}
        {ehAdmin && (
          <dl className={`${SUPERFICIE} grid grid-cols-1 sm:grid-cols-3 overflow-hidden`}>
            {PERFIS.map((p) => (
              <div key={p} className="px-5 sm:px-6 py-4 -ml-px -mt-px border-l border-t border-slate-200">
                <dt><SeloPerfil perfil={p} /></dt>
                <dd className="mt-2 text-[13px] text-slate-600 leading-relaxed">{DESCRICAO_PERFIL[p]}</dd>
              </div>
            ))}
          </dl>
        )}

        {aviso && <Aviso tipo="sucesso" onFechar={() => setAviso(null)}>{aviso}</Aviso>}
        {erroAcao && <AvisoErro mensagem={erroAcao} />}

        <section className={`${SUPERFICIE} overflow-hidden`}>
          {/* --- FILTROS --- */}
          <div className="p-4 sm:px-6 border-b border-slate-200 flex flex-wrap items-start gap-3">
            <div className="w-full sm:w-80">
              <input
                value={busca}
                onChange={(e) => { setBusca(e.target.value); setPagina(0) }}
                placeholder="Buscar por nome ou e-mail"
                aria-label="Buscar por nome ou e-mail"
                className={inputClasse()}
              />
              {buscaAtrasada.length > 0 && buscaAtrasada.length < BUSCA_MINIMA && (
                <p className="text-xs text-slate-500 mt-1.5">Digite pelo menos {BUSCA_MINIMA} caracteres.</p>
              )}
            </div>
            {ehAdmin && (
              <Selecao value={perfil} onChange={(e) => { setPerfil(e.target.value as Perfil | ""); setPagina(0) }} aria-label="Filtrar por perfil" className="w-full sm:w-48">
                <option value="">Todos os perfis</option>
                {PERFIS.map((p) => <option key={p} value={p}>{NOME_PERFIL[p]}</option>)}
              </Selecao>
            )}
            <Selecao value={situacao} onChange={(e) => { setSituacao(e.target.value as "" | "true" | "false"); setPagina(0) }} aria-label="Filtrar por situação" className="w-full sm:w-48">
              <option value="">Ativos e inativos</option>
              <option value="true">Só ativos</option>
              <option value="false">Só inativos</option>
            </Selecao>
          </div>

          {consulta.erro && (
            <div className="p-4 sm:px-6 border-b border-slate-200">
              <AvisoErro mensagem={`Não foi possível carregar os usuários: ${consulta.erro}`} onTentarNovamente={consulta.recarregar} />
            </div>
          )}

          {/* --- TABELA --- */}
          {!dados && consulta.carregando ? (
            <EsqueletoTabela rotulo="Carregando usuários" />
          ) : dados && dados.itens.length === 0 ? (
            <Vazio
              titulo={filtrando ? "Nenhum usuário encontrado" : ehAdmin ? "Nenhum usuário cadastrado" : "Nenhum operador cadastrado ainda"}
              descricao={filtrando ? "Nenhum usuário corresponde aos filtros aplicados." : undefined}
            />
          ) : dados ? (
            <div className={`overflow-x-auto transition-opacity ${consulta.carregando ? "opacity-60" : ""}`}>
              <table className={TABELA}>
                <thead className={THEAD}>
                  <tr>
                    {["Nome", "E-mail", "Perfil", "Situação", "Criado em", "Ações"].map((h) => (
                      <th key={h} className={TH}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className={TBODY}>
                  {dados.itens.map((u) => {
                    const proprio = u.id === logado?.id
                    return (
                      <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                        <td className={TD}>
                          <div className={`flex items-center gap-3 ${!u.ativo ? "opacity-60" : ""}`}>
                            <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 bg-slate-100 text-slate-700">
                              {iniciais(u.nome)}
                            </span>
                            <span className="text-slate-950 font-medium max-w-[220px] truncate" title={u.nome}>{u.nome}</span>
                            {proprio && <span className="text-xs text-slate-500">(você)</span>}
                          </div>
                        </td>
                        <td className={`${TD} text-slate-500`}>{u.email}</td>
                        <td className={TD}><SeloPerfil perfil={u.perfil} /></td>
                        <td className={TD}>
                          <Badge texto={u.ativo ? "Ativo" : "Inativo"} classe={u.ativo ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"} />
                        </td>
                        <td className={`${TD} text-slate-500`}>{fmt.dataHora(u.criado_em)}</td>
                        <td className={TD}>
                          <div className="flex items-center gap-1">
                            <BotaoAcao onClick={() => setModal({ tipo: "editar", usuario: u })}>Editar</BotaoAcao>
                            {!proprio && (
                              <>
                                <BotaoAcao onClick={() => setModal({ tipo: "senha", usuario: u })}>Redefinir senha</BotaoAcao>
                                {u.ativo ? (
                                  <BotaoAcao perigo onClick={() => setModal({ tipo: "desativar", usuario: u })}>Desativar</BotaoAcao>
                                ) : (
                                  <BotaoAcao onClick={() => void ativar(u)} disabled={ativandoId === u.id}>
                                    {ativandoId === u.id ? "Reativando..." : "Reativar"}
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

        <p className="text-[13px] text-slate-500">
          Para trocar a sua própria senha, use <strong className="font-medium text-slate-700">Minha conta</strong>, no rodapé do menu lateral.
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
    </div>
  )
}

// Perfis em escala de tinta (mais escuro = mais poder); a cor fica reservada para estados.
const ESTILO_PERFIL: Record<Perfil, string> = {
  administrador: "bg-tinta text-white",
  gestor: "bg-slate-200 text-slate-900",
  operador: "bg-white text-slate-700 border border-slate-300",
}

function SeloPerfil({ perfil }: { perfil: Perfil }) {
  return (
    <span className={`inline-flex items-center h-6 px-2 rounded-md text-xs font-medium ${ESTILO_PERFIL[perfil]}`}>
      {NOME_PERFIL[perfil]}
    </span>
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
      className={perigo ? BOTAO_PERIGO_FANTASMA_P : BOTAO_FANTASMA_P}
    >
      {children}
    </button>
  )
}
