// Formulário de criação/edição de regra da régua, com variáveis clicáveis e
// pré-visualização ao vivo (POST /regras/preview). A regra nasce inativa (RN02).

import { useEffect, useRef, useState } from "react"
import { useApi } from "../hooks/useApi"
import { useDebounce } from "../hooks/useDebounce"
import { ApiError, apiFetch } from "../lib/api"
import * as fmt from "../lib/formatos"
import { JANELA, LIMITE_POR_CANAL, trechosDoTemplate, validarRegra } from "../lib/regua"
import type { Canal, PreviewTemplate, Regra, RegraEntrada, VariavelTemplate } from "../lib/tipos"
import { AcoesModal, Aviso, AvisoErro, BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CampoForm, Modal, Spinner } from "./ui"
import { inputClasse } from "./estilos"

const CANAIS: Canal[] = ["email", "sms", "whatsapp"]

const TEMPLATE_INICIAL =
  "Olá, {primeiro_nome}! Identificamos uma pendência de {valor} com vencimento em {data_vencimento}. Entre em contato para regularizar."

interface EditorRegraProps {
  /** Sem regra = criação. */
  regra?: Regra
  onFechar: () => void
  onSalvo: (regra: Regra) => void
}

export default function EditorRegra({ regra, onFechar, onSalvo }: EditorRegraProps) {
  const [form, setForm] = useState<RegraEntrada>(() => ({
    nome: regra?.nome ?? "",
    canal: regra?.canal ?? "email",
    dias_atraso: regra?.dias_atraso ?? 5,
    horario_disparo: regra ? fmt.horario(regra.horario_disparo) : "09:00",
    template_mensagem: regra?.template_mensagem ?? TEMPLATE_INICIAL,
  }))
  const [tocado, setTocado] = useState(false) // só mostra erros por campo depois de tentar salvar
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const variaveis = useApi<VariavelTemplate[]>("/regras/variaveis")
  const nomesVariaveis = variaveis.dados?.map((v) => v.nome) ?? null
  const erros = validarRegra(form, nomesVariaveis)
  const valido = Object.keys(erros).length === 0
  const limite = LIMITE_POR_CANAL[form.canal]

  const alterar = <K extends keyof RegraEntrada>(campo: K, valor: RegraEntrada[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }))

  /** Insere a variável onde está o cursor do template. */
  const inserirVariavel = (placeholder: string) => {
    const area = textareaRef.current
    const texto = form.template_mensagem
    const inicio = area?.selectionStart ?? texto.length
    const fim = area?.selectionEnd ?? texto.length
    alterar("template_mensagem", texto.slice(0, inicio) + placeholder + texto.slice(fim))
    requestAnimationFrame(() => {
      area?.focus()
      area?.setSelectionRange(inicio + placeholder.length, inicio + placeholder.length)
    })
  }

  const salvar = async () => {
    setTocado(true)
    setErro(null)
    if (!valido) return

    const corpo: RegraEntrada = { ...form, nome: form.nome.trim() }
    setSalvando(true)
    try {
      let salva: Regra
      if (!regra) {
        salva = await apiFetch<Regra>("/regras/", { method: "POST", body: corpo })
      } else {
        // PATCH só com o que mudou (a API recusa um PATCH vazio)
        const original: RegraEntrada = {
          nome: regra.nome,
          canal: regra.canal,
          dias_atraso: regra.dias_atraso,
          horario_disparo: fmt.horario(regra.horario_disparo),
          template_mensagem: regra.template_mensagem,
        }
        const mudancas = Object.fromEntries(
          (Object.keys(corpo) as (keyof RegraEntrada)[])
            .filter((k) => corpo[k] !== original[k])
            .map((k) => [k, corpo[k]]),
        )
        salva = Object.keys(mudancas).length === 0
          ? regra
          : await apiFetch<Regra>(`/regras/${regra.id}`, { method: "PATCH", body: mudancas })
      }
      onSalvo(salva)
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Erro inesperado ao salvar a regra.")
      setSalvando(false)
    }
  }

  return (
    <Modal titulo={regra ? "Editar regra" : "Nova regra"} onFechar={onFechar} ocupado={salvando} largo>
      {regra?.ativa && (
        <div className="mb-5">
          <Aviso tipo="atencao">Esta regra está ativa: as alterações valem a partir do próximo ciclo de disparo.</Aviso>
        </div>
      )}
      {!regra && (
        <p className="mb-5 text-[13px] text-slate-500">
          A regra é criada <strong className="font-medium text-slate-800">inativa</strong>. Revise o template e ative-a na lista para começar os disparos.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* --- FORMULÁRIO --- */}
        <div className="space-y-5">
          <CampoForm rotulo="Nome da regra" erro={tocado ? erros.nome : undefined}>
            <input
              value={form.nome}
              onChange={(e) => alterar("nome", e.target.value)}
              maxLength={150}
              autoFocus
              placeholder="Ex.: Lembrete 5 dias (e-mail)"
              className={inputClasse(tocado ? erros.nome : undefined)}
            />
          </CampoForm>

          <CampoForm rotulo="Canal" grupo>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Canal">
              {CANAIS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={form.canal === c}
                  onClick={() => alterar("canal", c)}
                  className={`h-10 px-3 rounded-lg border text-sm font-medium transition-colors ${
                    form.canal === c ? "border-tinta bg-tinta text-white" : "border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                  }`}
                >
                  {fmt.NOME_CANAL[c]}
                </button>
              ))}
            </div>
          </CampoForm>

          <div className="grid grid-cols-2 gap-4">
            <CampoForm rotulo="Dias de atraso (D+)" erro={tocado ? erros.dias_atraso : undefined} dica="Dispara no dia em que o atraso é exatamente este.">
              <input
                type="number"
                min={1}
                max={365}
                value={Number.isNaN(form.dias_atraso) ? "" : form.dias_atraso}
                onChange={(e) => alterar("dias_atraso", e.target.valueAsNumber)}
                className={inputClasse(tocado ? erros.dias_atraso : undefined)}
              />
            </CampoForm>
            <CampoForm rotulo="Horário de disparo" erro={tocado ? erros.horario_disparo : undefined} dica={`A partir deste horário, entre ${JANELA.inicio} e ${JANELA.fim}.`}>
              <input
                type="time"
                min={JANELA.inicio}
                max="19:59"
                step={300}
                value={form.horario_disparo}
                onChange={(e) => alterar("horario_disparo", e.target.value)}
                className={inputClasse(tocado ? erros.horario_disparo : undefined)}
              />
            </CampoForm>
          </div>

          <CampoForm rotulo="Template da mensagem" erro={erros.template_mensagem}>
            <textarea
              ref={textareaRef}
              value={form.template_mensagem}
              onChange={(e) => alterar("template_mensagem", e.target.value)}
              rows={form.canal === "email" ? 9 : 6}
              className={`${inputClasse(erros.template_mensagem)} h-auto py-2.5 font-mono text-[13px] leading-relaxed resize-y`}
            />
            <div className="flex justify-end mt-1">
              <span className={`text-xs ${form.template_mensagem.length > limite ? "text-rose-700 font-medium" : "text-slate-500"}`}>
                {fmt.numero(form.template_mensagem.length)} / {fmt.numero(limite)}
              </span>
            </div>
          </CampoForm>

          <div>
            <p className="text-[13px] font-medium text-slate-700 mb-1.5">Inserir variável</p>
            {variaveis.dados ? (
              <div className="flex flex-wrap gap-1.5">
                {variaveis.dados.map((v) => (
                  <button
                    key={v.nome}
                    type="button"
                    onClick={() => inserirVariavel(v.placeholder)}
                    title={`${v.descricao} — ex.: ${v.exemplo}`}
                    className="h-7 px-2 rounded-md border border-slate-300 bg-white text-slate-800 font-mono text-xs hover:bg-slate-100 hover:border-slate-400 transition-colors"
                  >
                    {v.placeholder}
                  </button>
                ))}
              </div>
            ) : variaveis.erro ? (
              <p className="text-xs text-rose-700">Não foi possível carregar as variáveis.</p>
            ) : (
              <Spinner className="h-4 w-4 text-slate-400" />
            )}
          </div>
        </div>

        {/* --- PRÉ-VISUALIZAÇÃO --- */}
        <Previa template={form.template_mensagem} canal={form.canal} />
      </div>

      {erro && <div className="mt-5"><AvisoErro mensagem={erro} /></div>}

      <div className="mt-6 pt-1 border-t border-slate-200">
        <AcoesModal>
          <button onClick={onFechar} disabled={salvando} className={BOTAO_SECUNDARIO}>Cancelar</button>
          <button onClick={salvar} disabled={salvando || (tocado && !valido)} className={BOTAO_PRIMARIO}>
            {salvando && <Spinner />}
            {salvando ? "Salvando..." : regra ? "Salvar alterações" : "Criar regra"}
          </button>
        </AcoesModal>
      </div>
    </Modal>
  )
}

/** Template com as variáveis destacadas (usado na lista e no detalhe). */
export function TemplateDestacado({ template }: { template: string }) {
  return (
    <>
      {trechosDoTemplate(template).map((t, i) =>
        t.variavel ? (
          <span key={i} className="font-mono text-[12px] font-medium text-slate-950 bg-white px-1 py-px rounded border border-slate-300 mx-px">
            {t.texto}
          </span>
        ) : (
          <span key={i}>{t.texto}</span>
        ),
      )}
    </>
  )
}

/** POST /regras/preview com dados de exemplo, enquanto o usuário digita. */
function Previa({ template, canal }: { template: string; canal: Canal }) {
  const templateAtrasado = useDebounce(template, 500)
  const [previa, setPrevia] = useState<PreviewTemplate | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    if (!templateAtrasado.trim()) {
      setPrevia(null)
      setErro(null)
      return
    }
    const controle = new AbortController()
    setCarregando(true)
    apiFetch<PreviewTemplate>("/regras/preview", {
      method: "POST",
      body: { template_mensagem: templateAtrasado, canal },
      signal: controle.signal,
    })
      .then((p) => {
        setPrevia(p)
        setErro(null)
      })
      .catch((e: unknown) => {
        if (controle.signal.aborted) return
        setPrevia(null)
        setErro(e instanceof ApiError ? e.message : "Não foi possível gerar a pré-visualização.")
      })
      .finally(() => {
        if (!controle.signal.aborted) setCarregando(false)
      })
    return () => controle.abort()
  }, [templateAtrasado, canal])

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[13px] font-medium text-slate-700">Pré-visualização</span>
        {carregando && <Spinner className="h-3.5 w-3.5 text-slate-400" />}
      </div>
      <div className="flex-1 min-h-[200px] rounded-lg bg-slate-50 border border-slate-200 p-5">
        <p className="text-xs text-slate-500 mb-3">
          {fmt.NOME_CANAL[canal]}, com dados de exemplo
        </p>
        {erro ? (
          <p className="text-sm text-rose-700">{erro}</p>
        ) : previa ? (
          <>
            <p className="text-sm text-slate-900 leading-relaxed whitespace-pre-wrap break-words bg-white rounded-lg border border-slate-200 p-4">{previa.mensagem}</p>
            <p className={`mt-3 text-xs ${previa.tamanho > previa.limite ? "text-rose-700 font-medium" : "text-slate-500"}`}>
              Mensagem final: {fmt.numero(previa.tamanho)} de {fmt.numero(previa.limite)} caracteres
              {canal === "sms" && previa.tamanho > 160 && `, ${Math.ceil(previa.tamanho / 160)} partes de SMS`}
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-500">Escreva o template para ver como a mensagem fica.</p>
        )}
      </div>
      <p className="text-xs text-slate-500 mt-2">
        No envio real, as variáveis são trocadas pelos dados de cada devedor.
      </p>
    </div>
  )
}
