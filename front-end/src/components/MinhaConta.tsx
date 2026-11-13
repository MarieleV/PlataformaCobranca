// "Minha conta": dados do usuário logado e troca da própria senha (PUT /auth/senha).
// Qualquer perfil pode usar. As outras sessões abertas são encerradas pelo back-end;
// a atual continua (ele grava cookies novos na resposta).

import { useState } from "react"
import { useAuth } from "../auth/AuthContext"
import { NOME_PERFIL } from "../auth/permissoes"
import { ApiError, apiFetch } from "../lib/api"
import type { MensagemResponse } from "../lib/tipos"
import { validarSenha } from "../lib/usuarios"
import CampoSenha from "./CampoSenha"
import { AvisoErro, BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CampoForm, Modal } from "./ui"

export default function MinhaConta({ onFechar }: { onFechar: () => void }) {
  const { usuario } = useAuth()
  const [atual, setAtual] = useState("")
  const [nova, setNova] = useState("")
  const [confirmacao, setConfirmacao] = useState("")
  const [tocado, setTocado] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)

  const erros = {
    atual: atual ? null : "Informe a senha atual.",
    nova: validarSenha(nova) ?? (nova === atual && nova ? "A nova senha deve ser diferente da atual." : null),
    confirmacao: confirmacao === nova ? null : "As senhas não conferem.",
  }
  const valido = !erros.atual && !erros.nova && !erros.confirmacao

  const salvar = async () => {
    setTocado(true)
    setErro(null)
    if (!valido) return
    setSalvando(true)
    try {
      await apiFetch<MensagemResponse>("/auth/senha", { method: "PUT", body: { senha_atual: atual, nova_senha: nova } })
      setSucesso(true)
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Erro inesperado ao trocar a senha.")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal titulo="Minha conta" onFechar={onFechar} ocupado={salvando}>
      {usuario && (
        <div className="mb-5 p-4 rounded-xl bg-slate-50 border border-slate-100 text-sm">
          <p className="font-bold text-slate-900">{usuario.nome}</p>
          <p className="text-slate-500">{usuario.email}</p>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1">{NOME_PERFIL[usuario.perfil]}</p>
        </div>
      )}

      {sucesso ? (
        <>
          <p className="mb-6 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-sm font-semibold text-emerald-700" role="status">
            Senha alterada. As sessões abertas em outros navegadores ou aparelhos foram encerradas; esta continua ativa.
          </p>
          <div className="flex justify-end">
            <button onClick={onFechar} className={BOTAO_PRIMARIO}>Fechar</button>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Trocar senha</p>
          <div className="space-y-4">
            <CampoForm rotulo="Senha atual" erro={tocado ? erros.atual : null}>
              <CampoSenha valor={atual} onChange={setAtual} erro={tocado ? erros.atual : null} autoComplete="current-password" autoFocus />
            </CampoForm>
            <CampoForm rotulo="Nova senha" erro={tocado ? erros.nova : null} dica="De 8 a 128 caracteres, com ao menos uma letra e um número.">
              <CampoSenha valor={nova} onChange={setNova} erro={tocado ? erros.nova : null} />
            </CampoForm>
            <CampoForm rotulo="Confirme a nova senha" erro={tocado ? erros.confirmacao : null}>
              <CampoSenha valor={confirmacao} onChange={setConfirmacao} erro={tocado ? erros.confirmacao : null} />
            </CampoForm>
          </div>
          {erro && <div className="mt-4"><AvisoErro mensagem={erro} /></div>}
          <div className="flex justify-end gap-2 mt-6">
            <button onClick={onFechar} disabled={salvando} className={BOTAO_SECUNDARIO}>Cancelar</button>
            <button onClick={salvar} disabled={salvando} className={BOTAO_PRIMARIO}>
              {salvando ? "Salvando..." : "Trocar senha"}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
