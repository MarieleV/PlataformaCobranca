// Log de auditoria (UC07-A5 / RF11): exclusivo do administrador.

import { useState } from "react"
import { AvisoErro, Painel, Spinner, inputClasse } from "../components/ui"
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
    <div className="p-4 md:p-6 xl:p-8 overflow-y-auto h-full bg-slate-50 font-sans space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Auditoria</h1>
        <p className="text-sm text-slate-500 mt-1">
          Quem fez o quê e quando: logins, gestão de usuários, régua e ações sobre devedores. Somente leitura.
        </p>
      </div>

      {/* --- FILTROS --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 items-end">
        <label className="block">
          <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Usuário</span>
          <select value={usuarioId} onChange={filtro(setUsuarioId)} className={inputClasse()}>
            <option value="">Todos</option>
            {usuarios.dados?.itens.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Ação</span>
          <select value={acao} onChange={filtro(setAcao)} className={inputClasse()}>
            <option value="">Todas</option>
            {Object.entries(NOME_ACAO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Entidade</span>
          <select value={entidade} onChange={filtro(setEntidade)} className={inputClasse()}>
            <option value="">Todas</option>
            {Object.entries(NOME_ENTIDADE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">De</span>
          <input type="date" value={de} max={ate || fmt.hojeISO()} onChange={filtro(setDe)} className={inputClasse(periodoInvalido ? "x" : null)} />
        </label>
        <label className="block">
          <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Até</span>
          <input type="date" value={ate} min={de || undefined} max={fmt.hojeISO()} onChange={filtro(setAte)} className={inputClasse(periodoInvalido ? "x" : null)} />
        </label>
      </div>
      <div className="flex items-center gap-4 -mt-2">
        {periodoInvalido && <p className="text-xs font-medium text-rose-600">A data inicial é depois da final: o filtro de período foi ignorado.</p>}
        {filtrando && <button onClick={limpar} className="text-xs font-bold text-slate-500 hover:text-black">Limpar filtros</button>}
      </div>

      {consulta.erro && <AvisoErro mensagem={`Não foi possível carregar a auditoria: ${consulta.erro}`} onTentarNovamente={consulta.recarregar} />}

      <Painel
        titulo={<>Registros {dados && <span className="font-mono text-slate-400">({fmt.numero(dados.total)})</span>}</>}
        subtitulo="Mais recentes primeiro. Datas no horário de Brasília."
        acao={<button onClick={consulta.recarregar} className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50">Atualizar</button>}
      >
        {!dados && consulta.carregando ? (
          <div className="px-6 py-10 flex justify-center gap-2 text-sm text-slate-500"><Spinner /> Carregando...</div>
        ) : dados && dados.itens.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm font-medium text-slate-400">
            {filtrando ? "Nenhum registro com os filtros aplicados." : "Nenhum registro de auditoria ainda."}
          </p>
        ) : dados ? (
          <div className={`overflow-x-auto transition-opacity ${consulta.carregando ? "opacity-60" : ""}`}>
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50/50">
                <tr>
                  {["Data e hora", "Usuário", "Ação", "Entidade", "Registro", "IP"].map((h) => (
                    <th key={h} className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dados.itens.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/80">
                    <td className="px-6 py-3 font-mono text-xs text-slate-600">{fmt.dataHora(l.criado_em)}</td>
                    <td className="px-6 py-3">
                      {l.usuario_nome ? (
                        <>
                          <p className="text-[13px] font-semibold text-slate-800 max-w-[220px] truncate">{l.usuario_nome}</p>
                          <p className="font-mono text-[11px] text-slate-400">{l.usuario_email}</p>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400" title="Login com e-mail não cadastrado ou usuário que foi excluído">
                          Sem usuário vinculado
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`text-xs font-semibold ${ACOES_ALERTA.has(l.acao) ? "text-rose-600" : "text-slate-700"}`}>
                        {NOME_ACAO[l.acao] ?? l.acao}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-xs text-slate-600">{l.entidade ? (NOME_ENTIDADE[l.entidade] ?? l.entidade) : "—"}</td>
                    <td className="px-6 py-3 font-mono text-[11px] text-slate-400" title={l.entidade_id ?? undefined}>
                      {l.entidade_id ? `${l.entidade_id.slice(0, 8)}…` : "—"}
                    </td>
                    <td className="px-6 py-3 font-mono text-[11px] text-slate-500">{l.ip ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {dados && dados.total > POR_PAGINA && (
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
