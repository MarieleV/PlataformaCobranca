// Modais da gestão de usuários. As regras espelham back-end/app/api/usuarios.py:
// - gestor só cria/gerencia operadores e não altera perfil;
// - ninguém altera o próprio perfil, desativa/exclui a própria conta ou
//   redefine a própria senha por aqui (para isso: "Minha conta");
// - desativar e redefinir a senha encerram as sessões do usuário;
// - quem tem lotes ou regras vinculados não pode ser excluído (409).

import { useState } from "react"
import { useAuth } from "../auth/AuthContext"
import { NOME_PERFIL, PERFIS_POR_ACAO } from "../auth/permissoes"
import { ApiError, apiFetch } from "../lib/api"
import type { MensagemResponse, Perfil, UsuarioEntrada, UsuarioGerenciado } from "../lib/tipos"
import { validarEmail, validarNome, validarSenha } from "../lib/usuarios"
import CampoSenha from "./CampoSenha"
import { AvisoErro, BOTAO_PERIGO, BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CampoForm, Modal, inputClasse } from "./ui"

const PERFIS: Perfil[] = ["operador", "gestor", "administrador"]

export const DESCRICAO_PERFIL: Record<Perfil, string> = {
  administrador: "Acesso total: usuários de todos os perfis, auditoria, exclusão de devedores (LGPD) e todas as telas.",
  gestor: "Régua de cobrança, marcar devedor como quitado e gestão de operadores, além das telas de consulta.",
  operador: "Importação de lotes e consulta de devedores, régua, dashboard e monitoramento.",
}

function mensagem(e: unknown, padrao: string): string {
  return e instanceof ApiError ? e.message : padrao
}

// --- Criar / editar -----------------------------------------------------------

export function FormUsuario({ usuario, onFechar, onSalvo }: {
  /** Sem usuário = criação. */
  usuario?: UsuarioGerenciado
  onFechar: () => void
  onSalvo: (u: UsuarioGerenciado) => void
}) {
  const { usuario: logado, pode, recarregarUsuario } = useAuth()
  const ehAdmin = pode(PERFIS_POR_ACAO.administrarUsuarios)
  const ehProprio = usuario?.id === logado?.id
  // Perfil: só o admin escolhe, e nunca o próprio
  const podeEscolherPerfil = ehAdmin && !ehProprio

  const [form, setForm] = useState<UsuarioEntrada>({
    nome: usuario?.nome ?? "",
    email: usuario?.email ?? "",
    senha: "",
    perfil: usuario?.perfil ?? "operador",
  })
  const [tocado, setTocado] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const erros = {
    nome: validarNome(form.nome),
    email: validarEmail(form.email),
    senha: usuario ? null : validarSenha(form.senha),
  }
  const valido = !erros.nome && !erros.email && !erros.senha
  const alterar = <K extends keyof UsuarioEntrada>(k: K, v: UsuarioEntrada[K]) => setForm((f) => ({ ...f, [k]: v }))

  const salvar = async () => {
    setTocado(true)
    setErro(null)
    if (!valido) return
    setSalvando(true)
    try {
      let salvo: UsuarioGerenciado
      if (!usuario) {
        salvo = await apiFetch<UsuarioGerenciado>("/usuarios/", {
          method: "POST",
          body: { nome: form.nome.trim(), email: form.email.trim(), senha: form.senha, perfil: ehAdmin ? form.perfil : "operador" },
        })
      } else {
        // PATCH só com o que mudou (a API recusa PATCH vazio)
        const mudancas: Partial<Record<"nome" | "email" | "perfil", string>> = {}
        if (form.nome.trim() !== usuario.nome) mudancas.nome = form.nome.trim()
        if (form.email.trim().toLowerCase() !== usuario.email) mudancas.email = form.email.trim()
        if (podeEscolherPerfil && form.perfil !== usuario.perfil) mudancas.perfil = form.perfil
        salvo = Object.keys(mudancas).length === 0
          ? usuario
          : await apiFetch<UsuarioGerenciado>(`/usuarios/${usuario.id}`, { method: "PATCH", body: mudancas })
        if (ehProprio) await recarregarUsuario() // atualiza nome/e-mail na sidebar
      }
      onSalvo(salvo)
    } catch (e) {
      setErro(mensagem(e, "Erro inesperado ao salvar o usuário."))
      setSalvando(false)
    }
  }

  return (
    <Modal titulo={usuario ? "Editar usuário" : "Novo usuário"} onFechar={onFechar} ocupado={salvando}>
      <div className="space-y-4">
        <CampoForm rotulo="Nome completo" erro={tocado ? erros.nome : null}>
          <input value={form.nome} onChange={(e) => alterar("nome", e.target.value)} maxLength={150} autoFocus placeholder="Ex.: João da Silva" className={inputClasse(tocado ? erros.nome : null)} />
        </CampoForm>
        <CampoForm rotulo="E-mail (login)" erro={tocado ? erros.email : null}>
          <input type="email" value={form.email} onChange={(e) => alterar("email", e.target.value)} placeholder="joao@empresa.com.br" autoComplete="off" className={inputClasse(tocado ? erros.email : null)} />
        </CampoForm>

        {!usuario && (
          <CampoForm
            rotulo="Senha inicial"
            erro={tocado ? erros.senha : null}
            dica="De 8 a 128 caracteres, com letra e número. Passe-a ao usuário por um canal seguro; ele pode trocá-la em Minha conta."
          >
            <CampoSenha valor={form.senha} onChange={(v) => alterar("senha", v)} erro={tocado ? erros.senha : null} permitirGerar />
          </CampoForm>
        )}

        {podeEscolherPerfil ? (
          <CampoForm rotulo="Perfil de acesso" dica={DESCRICAO_PERFIL[form.perfil]}>
            <select value={form.perfil} onChange={(e) => alterar("perfil", e.target.value as Perfil)} className={inputClasse()}>
              {PERFIS.map((p) => <option key={p} value={p}>{NOME_PERFIL[p]}</option>)}
            </select>
          </CampoForm>
        ) : (
          <p className="text-xs text-slate-500">
            Perfil: <strong>{NOME_PERFIL[usuario?.perfil ?? "operador"]}</strong>
            {ehProprio ? " (você não pode alterar o próprio perfil)." : !ehAdmin ? " (o gestor só gerencia operadores)." : ""}
          </p>
        )}

        {usuario && form.perfil !== usuario.perfil && (
          <p className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
            O novo perfil vale na próxima ação do usuário (as permissões são lidas do banco a cada requisição).
          </p>
        )}
      </div>

      {erro && <div className="mt-4"><AvisoErro mensagem={erro} /></div>}
      <div className="flex justify-end gap-2 mt-6">
        <button onClick={onFechar} disabled={salvando} className={BOTAO_SECUNDARIO}>Cancelar</button>
        <button onClick={salvar} disabled={salvando} className={BOTAO_PRIMARIO}>
          {salvando ? "Salvando..." : usuario ? "Salvar alterações" : "Criar usuário"}
        </button>
      </div>
    </Modal>
  )
}

// --- Redefinir senha ------------------------------------------------------------

export function RedefinirSenha({ usuario, onFechar, onFeito }: {
  usuario: UsuarioGerenciado
  onFechar: () => void
  onFeito: (msg: string) => void
}) {
  const [senha, setSenha] = useState("")
  const [tocado, setTocado] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const erroSenha = validarSenha(senha)

  const salvar = async () => {
    setTocado(true)
    setErro(null)
    if (erroSenha) return
    setSalvando(true)
    try {
      await apiFetch<MensagemResponse>(`/usuarios/${usuario.id}/redefinir-senha`, { method: "POST", body: { nova_senha: senha } })
      onFeito(`Senha de ${usuario.nome} redefinida. As sessões abertas dele foram encerradas.`)
    } catch (e) {
      setErro(mensagem(e, "Erro inesperado ao redefinir a senha."))
      setSalvando(false)
    }
  }

  return (
    <Modal titulo="Redefinir senha" onFechar={onFechar} ocupado={salvando}>
      <p className="text-sm text-slate-600 mb-4">
        Define uma nova senha para <strong>{usuario.nome}</strong> e encerra as sessões abertas dele. Passe a senha ao usuário por um canal seguro.
      </p>
      <CampoForm rotulo="Nova senha" erro={tocado ? erroSenha : null} dica="De 8 a 128 caracteres, com letra e número.">
        <CampoSenha valor={senha} onChange={setSenha} erro={tocado ? erroSenha : null} permitirGerar autoFocus />
      </CampoForm>
      {erro && <div className="mt-4"><AvisoErro mensagem={erro} /></div>}
      <div className="flex justify-end gap-2 mt-6">
        <button onClick={onFechar} disabled={salvando} className={BOTAO_SECUNDARIO}>Cancelar</button>
        <button onClick={salvar} disabled={salvando} className={BOTAO_PRIMARIO}>{salvando ? "Salvando..." : "Redefinir senha"}</button>
      </div>
    </Modal>
  )
}

// --- Desativar / excluir -----------------------------------------------------------

export function ConfirmarAcaoUsuario({ usuario, acao, onFechar, onFeito, onDesativarEmVez }: {
  usuario: UsuarioGerenciado
  acao: "desativar" | "excluir"
  onFechar: () => void
  onFeito: (msg: string) => void
  /** Exclusão recusada por vínculos (409): oferece desativar. */
  onDesativarEmVez?: () => void
}) {
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<ApiError | null>(null)

  const confirmar = async () => {
    setErro(null)
    setEnviando(true)
    try {
      if (acao === "desativar") {
        await apiFetch(`/usuarios/${usuario.id}/desativar`, { method: "POST" })
        onFeito(`${usuario.nome} foi desativado e as sessões dele foram encerradas.`)
      } else {
        await apiFetch(`/usuarios/${usuario.id}`, { method: "DELETE" })
        onFeito(`${usuario.nome} foi excluído.`)
      }
    } catch (e) {
      setErro(e instanceof ApiError ? e : new ApiError(0, "Erro inesperado."))
      setEnviando(false)
    }
  }

  const comVinculos = acao === "excluir" && erro?.status === 409

  return (
    <Modal titulo={acao === "desativar" ? "Desativar usuário?" : "Excluir usuário?"} onFechar={onFechar} ocupado={enviando}>
      <p className="text-sm text-slate-600 mb-4">
        {acao === "desativar" ? (
          <><strong>{usuario.nome}</strong> perde o acesso imediatamente e as sessões abertas são encerradas. Os registros dele são mantidos; dá para reativar depois.</>
        ) : (
          <><strong>{usuario.nome}</strong> será apagado definitivamente. Quem já importou lotes ou criou regras não pode ser excluído — nesse caso, desative.</>
        )}
      </p>
      {erro && <div className="mb-4"><AvisoErro mensagem={erro.message} /></div>}
      <div className="flex justify-end gap-2">
        <button onClick={onFechar} disabled={enviando} className={BOTAO_SECUNDARIO}>Cancelar</button>
        {comVinculos ? (
          usuario.ativo && onDesativarEmVez && <button onClick={onDesativarEmVez} className={BOTAO_PRIMARIO}>Desativar em vez disso</button>
        ) : (
          <button onClick={confirmar} disabled={enviando} className={acao === "excluir" ? BOTAO_PERIGO : BOTAO_PRIMARIO}>
            {enviando ? "Aguarde..." : acao === "desativar" ? "Desativar" : "Excluir definitivamente"}
          </button>
        )}
      </div>
    </Modal>
  )
}
