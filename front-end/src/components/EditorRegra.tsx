// Formulário de criação/edição de regra da régua, com variáveis clicáveis e
// pré-visualização ao vivo (POST /regras/preview). A regra nasce inativa (RN02).

import { useEffect, useRef, useState, type ReactNode } from "react"
import { useApi } from "../hooks/useApi"
import { useDebounce } from "../hooks/useDebounce"
import { ApiError, apiFetch } from "../lib/api"
import * as fmt from "../lib/formatos"
import { JANELA, LIMITE_POR_CANAL, trechosDoTemplate, validarRegra } from "../lib/regua"
import type { Canal, PreviewTemplate, Regra, RegraEntrada, VariavelTemplate } from "../lib/tipos"
import { AvisoErro, BOTAO_PRIMARIO, BOTAO_SECUNDARIO, Modal, Spinner } from "./ui"

const CANAIS: Canal[] = ["email", "sms", "whatsapp"]

const TEMPLATE_INICIAL =
  "Olá, {primeiro_nome}! Identificamos uma pendência de {valor} com vencimento em {data_vencimento}. Entre em contato para regularizar."

interface EditorRegraProps {
  /** Sem regra = criação. */
  regra?: Regra
  onFechar: () => void
  onSalvo: (regra: Regra) => void
}

const INPUT =
  "w-full px-3 py-2.5 rounded-xl border bg-white text-sm text-slate-900 outline-none focus:ring-4 transition-all"
const inputClasse = (erro?: string) =>
  `${INPUT} ${erro ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500/10" : "border-slate-200 focus:border-black focus:ring-black/5"}`

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
        <p className="mb-4 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
          Esta regra está ativa: as alterações valem a partir do próximo ciclo de disparo.
        </p>
      )}
      {!regra && (
        <p className="mb-4 text-xs font-medium text-slate-500">
          A regra é criada <strong>inativa</strong>. Revise o template e ative-a na lista para começar os disparos.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* --- FORMULÁRIO --- */}
        <div className="space-y-4">
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
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                    form.canal === c ? "border-black bg-black text-white" : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: fmt.COR_CANAL[c] }} />
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
              className={`${inputClasse(erros.template_mensagem)} font-mono text-[13px] leading-relaxed resize-y`}
            />
            <div className="flex justify-end mt-1">
              <span className={`text-[11px] font-mono font-semibold ${form.template_mensagem.length > limite ? "text-rose-600" : "text-slate-400"}`}>
                {fmt.numero(form.template_mensagem.length)} / {fmt.numero(limite)}
              </span>
            </div>
          </CampoForm>

          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Inserir variável</p>
            {variaveis.dados ? (
              <div className="flex flex-wrap gap-1.5">
                {variaveis.dados.map((v) => (
                  <button
                    key={v.nome}
                    type="button"
                    onClick={() => inserirVariavel(v.placeholder)}
                    title={`${v.descricao} — ex.: ${v.exemplo}`}
                    className="px-2 py-1 rounded-md border border-blue-200 bg-blue-50 text-blue-700 font-mono text-xs font-semibold hover:bg-blue-100 transition-colors"
                  >
                    {v.placeholder}
                  </button>
                ))}
              </div>
            ) : variaveis.erro ? (
              <p className="text-xs text-rose-600">Não foi possível carregar as variáveis.</p>
            ) : (
              <Spinner className="h-4 w-4 text-slate-400" />
            )}
          </div>
        </div>

        {/* --- PRÉ-VISUALIZAÇÃO --- */}
        <Previa template={form.template_mensagem} canal={form.canal} />
      </div>

      {erro && <div className="mt-5"><AvisoErro mensagem={erro} /></div>}

      <div className="flex justify-end gap-2 mt-6 pt-5 border-t border-slate-100">
        <button onClick={onFechar} disabled={salvando} className={BOTAO_SECUNDARIO}>Cancelar</button>
        <button onClick={salvar} disabled={salvando || (tocado && !valido)} className={BOTAO_PRIMARIO}>
          {salvando ? "Salvando..." : regra ? "Salvar alterações" : "Criar regra"}
        </button>
      </div>
    </Modal>
  )
}

function CampoForm({ rotulo, erro, dica, grupo = false, children }: {
  rotulo: string
  erro?: string
  dica?: string
  /** true quando o conteúdo é um grupo de botões (não pode ficar dentro de <label>). */
  grupo?: boolean
  children: ReactNode
}) {
  const Tag = grupo ? "div" : "label"
  return (
    <Tag className="block">
      <span className="block text-xs font-bold text-slate-700 mb-1.5">{rotulo}</span>
      {children}
      {erro ? (
        <span className="block text-xs font-medium text-rose-600 mt-1">{erro}</span>
      ) : dica ? (
        <span className="block text-[11px] text-slate-400 mt-1">{dica}</span>
      ) : null}
    </Tag>
  )
}

/** Template com as variáveis destacadas (usado na lista e no detalhe). */
export function TemplateDestacado({ template }: { template: string }) {
  return (
    <>
      {trechosDoTemplate(template).map((t, i) =>
        t.variavel ? (
          <span key={i} className="text-blue-700 font-bold bg-blue-50/80 px-1 py-0.5 rounded border border-blue-200 mx-0.5">
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
        <span className="text-xs font-bold text-slate-700">Pré-visualização</span>
        {carregando && <Spinner className="h-3.5 w-3.5 text-slate-400" />}
      </div>
      <div className="flex-1 min-h-[200px] rounded-2xl bg-slate-50 border border-slate-200 p-5">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
          {fmt.NOME_CANAL[canal]} · com dados de exemplo
        </p>
        {erro ? (
          <p className="text-sm font-medium text-rose-600">{erro}</p>
        ) : previa ? (
          <>
            <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap break-words">{previa.mensagem}</p>
            <p className={`mt-4 text-[11px] font-mono font-semibold ${previa.tamanho > previa.limite ? "text-rose-600" : "text-slate-400"}`}>
              Mensagem final: {fmt.numero(previa.tamanho)} de {fmt.numero(previa.limite)} caracteres
              {canal === "sms" && previa.tamanho > 160 && ` · ${Math.ceil(previa.tamanho / 160)} partes de SMS`}
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-400">Escreva o template para ver como a mensagem fica.</p>
        )}
      </div>
      <p className="text-[11px] text-slate-400 mt-2">
        No envio real, as variáveis são trocadas pelos dados de cada devedor.
      </p>
    </div>
  )
}
