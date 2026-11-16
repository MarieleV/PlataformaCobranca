// Log de auditoria (UC07-A5 / RF11): exclusivo do administrador.

import { useState } from "react"
import { CONTEUDO, ID, inputClasse, PAGINA, ROTULO, TABELA, TBODY, TD, TH, THEAD } from "../components/estilos"
import {
  AvisoErro,
  BOTAO_FANTASMA_P,
  BOTAO_SECUNDARIO_P,
  CabecalhoPagina,
  Contagem,
  EsqueletoTabela,
  Paginacao,
  Painel,
  Selecao,
  Vazio,
} from "../components/ui"
import { useApi } from "../hooks/useApi"
import * as fmt from "../lib/formatos"
import type { LogAuditoria, Pagina, UsuarioGerenciado } from "../lib/tipos"
import { NOME_ACAO, NOME_ENTIDADE } from "../lib/usuarios"

const POR_PAGINA = 50

// Ações sensíveis ganham destaque na tabela
const ACOES_ALERTA = new Set(["login_falha", "excluir_usuario", "excluir_devedor", "excluir_regra", "desativar_usuario", "redefinir_senha", "alterar_perfil_usuario"])

export default function Auditoria() {
  const [usuarioId, setUsuarioId] = useState("")
  const [acao, setAcao] = useState("")
  const [entidade, setEntidade] = useState("")
  const [de, setDe] = useState("")
  const [ate, setAte] = useState("")
  const [pagina, setPagina] = useState(0)

  const periodoInvalido = Boolean(de && ate && de > ate)
  const query = new URLSearchParams({ skip: String(pagina * POR_PAGINA), limit: String(POR_PAGINA) })
  if (usuarioId) query.set("usuario_id", usuarioId)
  if (acao) query.set("acao", acao)
  if (entidade) query.set("entidade", entidade)
  if (de && !periodoInvalido) query.set("de", de)
  if (ate && !periodoInvalido) query.set("ate", ate)

  const consulta = useApi<Pagina<LogAuditoria>>(`/auditoria/?${query}`)
  const usuarios = useApi<Pagina<UsuarioGerenciado>>("/usuarios/?limit=200")
  const dados = consulta.dados
  const totalPaginas = dados ? Math.max(1, Math.ceil(dados.total / POR_PAGINA)) : 1
  const filtrando = Boolean(usuarioId || acao || entidade || de || ate)

  // Qualquer filtro novo volta para a primeira página
  const filtro = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setter(e.target.value)
    setPagina(0)
  }
  const limpar = () => {
    setUsuarioId(""); setAcao(""); setEntidade(""); setDe(""); setAte(""); setPagina(0)
  }

  return (
    <div className={PAGINA}>
      <div className={CONTEUDO}>
        <CabecalhoPagina
          titulo="Auditoria"
          descricao="Quem fez o quê e quando: logins, gestão de usuários, régua e ações sobre devedores. Somente leitura."
        />

        {consulta.erro && <AvisoErro mensagem={`Não foi possível carregar a auditoria: ${consulta.erro}`} onTentarNovamente={consulta.recarregar} />}

        <Painel
          titulo={<>Registros {dados && <Contagem valor={fmt.numero(dados.total)} />}</>}
          subtitulo="Mais recentes primeiro. Datas no horário de Brasília."
          acao={<button onClick={consulta.recarregar} className={BOTAO_SECUNDARIO_P}>Atualizar</button>}
        >
          {/* --- FILTROS --- */}
          <div className="px-5 sm:px-6 py-4 border-b border-slate-200 bg-slate-50/50">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 items-end">
              <label className="block">
                <span className={ROTULO}>Usuário</span>
                <Selecao value={usuarioId} onChange={filtro(setUsuarioId)}>
                  <option value="">Todos</option>
                  {usuarios.dados?.itens.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </Selecao>
              </label>
              <label className="block">
                <span className={ROTULO}>Ação</span>
                <Selecao value={acao} onChange={filtro(setAcao)}>
                  <option value="">Todas</option>
                  {Object.entries(NOME_ACAO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Selecao>
              </label>
              <label className="block">
                <span className={ROTULO}>Entidade</span>
                <Selecao value={entidade} onChange={filtro(setEntidade)}>
                  <option value="">Todas</option>
                  {Object.entries(NOME_ENTIDADE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Selecao>
              </label>
              <label className="block">
                <span className={ROTULO}>De</span>
                <input type="date" value={de} max={ate || fmt.hojeISO()} onChange={filtro(setDe)} className={inputClasse(periodoInvalido ? "x" : null)} />
              </label>
              <label className="block">
                <span className={ROTULO}>Até</span>
                <input type="date" value={ate} min={de || undefined} max={fmt.hojeISO()} onChange={filtro(setAte)} className={inputClasse(periodoInvalido ? "x" : null)} />
              </label>
            </div>
            {(periodoInvalido || filtrando) && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3">
                {periodoInvalido && <p className="text-xs font-medium text-rose-700">A data inicial é depois da final: o filtro de período foi ignorado.</p>}
                {filtrando && <button onClick={limpar} className={`-ml-3 ${BOTAO_FANTASMA_P}`}>Limpar filtros</button>}
              </div>
            )}
          </div>

          {!dados && consulta.carregando ? (
            <EsqueletoTabela rotulo="Carregando registros" />
          ) : dados && dados.itens.length === 0 ? (
            <Vazio
              titulo={filtrando ? "Nenhum registro encontrado" : "Nenhum registro de auditoria ainda"}
              descricao={filtrando ? "Nenhum registro corresponde aos filtros aplicados." : undefined}
            />
          ) : dados ? (
            <div className={`overflow-x-auto transition-opacity ${consulta.carregando ? "opacity-60" : ""}`}>
              <table className={TABELA}>
                <thead className={THEAD}>
                  <tr>
                    {["Data e hora", "Usuário", "Ação", "Entidade", "Registro", "IP"].map((h) => (
                      <th key={h} className={TH}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className={TBODY}>
                  {dados.itens.map((l) => {
                    const alerta = ACOES_ALERTA.has(l.acao)
                    return (
                      <tr key={l.id}>
                        <td className={`${TD} text-slate-500`}>{fmt.dataHora(l.criado_em)}</td>
                        <td className={TD}>
                          {l.usuario_nome ? (
                            <>
                              <p className="font-medium text-slate-950 max-w-[220px] truncate">{l.usuario_nome}</p>
                              <p className="text-xs text-slate-500">{l.usuario_email}</p>
                            </>
                          ) : (
                            <span className="text-slate-500" title="Login com e-mail não cadastrado ou usuário que foi excluído">
                              Sem usuário vinculado
                            </span>
                          )}
                        </td>
                        <td className={TD}>
                          {/* Ações sensíveis: cor + ícone (nunca só a cor) */}
                          <span className={`inline-flex items-center gap-1.5 ${alerta ? "font-medium text-rose-800" : "text-slate-800"}`}>
                            {alerta && (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-label="Ação sensível">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.5m0 3.5h.01M10.3 4.2L2.6 17.5A2 2 0 004.3 20.5h15.4a2 2 0 001.7-3L13.7 4.2a2 2 0 00-3.4 0z" />
                              </svg>
                            )}
                            {NOME_ACAO[l.acao] ?? l.acao}
                          </span>
                        </td>
                        <td className={TD}>{l.entidade ? (NOME_ENTIDADE[l.entidade] ?? l.entidade) : "—"}</td>
                        <td className={`${TD} ${ID}`} title={l.entidade_id ?? undefined}>
                          {l.entidade_id ? `${l.entidade_id.slice(0, 8)}…` : "—"}
                        </td>
                        <td className={`${TD} ${ID}`}>{l.ip ?? "—"}</td>
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
        </Painel>
      </div>
    </div>
  )
}
