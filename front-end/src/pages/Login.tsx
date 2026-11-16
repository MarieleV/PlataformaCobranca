import { useState } from "react"
import logoTcc from "../assets/logo-tcc.png"
import { useAuth } from "../auth/AuthContext"
import { inputClasse } from "../components/estilos"
import { Aviso, BOTAO_PRIMARIO, Spinner } from "../components/ui"
import { ApiError } from "../lib/api"

// Mensagem de erro do login para a tela. 401, 403 e 429 já vêm em português
// do back-end; o 422 (validação do Pydantic) vem em inglês e é traduzido aqui.
function mensagemDeErro(erro: unknown): string {
  if (erro instanceof ApiError) {
    if (erro.status === 422) return "Informe um e-mail válido."
    return erro.message
  }
  return "Erro inesperado. Tente novamente."
}

export default function Login() {
  const { login, sessaoExpirada } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!email.trim() || !password) {
      setError("Por favor, preencha todos os campos para continuar.")
      return
    }

    setLoading(true)
    try {
      await login(email.trim(), password)
      // Sucesso: o AuthContext troca o usuário e o App sai desta tela.
    } catch (erro) {
      setError(mensagemDeErro(erro))
      setPassword("")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-papel">

      {/* --- PAINEL ESQUERDO (marca) --- */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] bg-tinta px-12 py-12 text-white flex-shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-20">
            <div className="bg-white rounded-lg w-10 h-10 flex items-center justify-center overflow-hidden">
              <img src={logoTcc} alt="" className="w-full h-full object-contain p-1.5" />
            </div>
            <div className="leading-tight">
              <p className="font-semibold">Cobrança Automatizada</p>
              <p className="text-sm text-white/60">Consulth Soluções</p>
            </div>
          </div>

          <h1 className="text-[2rem] font-semibold leading-[1.15] tracking-tight mb-5">
            Escale sua recuperação de crédito com segurança total.
          </h1>
          <p className="text-white/70 leading-relaxed max-w-[38ch]">
            Automatize todo o ciclo de cobrança: da integração de dados ao acionamento multicanal. Tenha rastreabilidade ponta a ponta com zero intervenção manual.
          </p>

          <ReguaDecorativa />
        </div>

        <dl className="divide-y divide-white/10 border-y border-white/10">
          {[
            { metric: "70M+", label: "Inadimplentes no Brasil (Serasa)" },
            { metric: "10k", label: "Registros processados por minuto" },
            { metric: "95%+", label: "Taxa de entrega multicanal" },
          ].map((s) => (
            <div key={s.metric} className="flex items-baseline gap-5 py-3.5">
              <dt className="font-semibold text-xl min-w-[72px] tracking-tight">{s.metric}</dt>
              <dd className="text-sm text-white/65">{s.label}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* --- PAINEL DIREITO (formulário) --- */}
      <div className="flex-1 flex items-center justify-center px-4 py-10 sm:px-12">
        <div className="w-full max-w-[400px]">

          <div className="lg:hidden flex items-center gap-3 mb-10">
            <img src={logoTcc} alt="" className="w-9 h-9 object-contain rounded-md" />
            <p className="font-semibold text-slate-950">Cobrança Automatizada</p>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-950 tracking-tight">Acessar plataforma</h2>
            <p className="text-sm text-slate-500 mt-1.5">Insira suas credenciais corporativas para continuar.</p>
          </div>

          {sessaoExpirada && !error && (
            <div className="mb-5">
              <Aviso tipo="atencao">Sua sessão expirou. Entre novamente para continuar.</Aviso>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-[13px] font-medium text-slate-700 mb-1.5">
                E-mail corporativo
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="analista@empresa.com.br"
                className={`${inputClasse()} h-11`}
              />
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-3 mb-1.5">
                <label htmlFor="password" className="text-[13px] font-medium text-slate-700">
                  Senha
                </label>
                {/* Não há recuperação por e-mail: quem redefine é o gestor/administrador. */}
                <span className="text-xs text-slate-500">Esqueceu? Fale com o administrador.</span>
              </div>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`${inputClasse()} h-11`}
              />
            </div>

            {error && <Aviso tipo="erro">{error}</Aviso>}

            <button type="submit" disabled={loading} className={`w-full h-11 ${BOTAO_PRIMARIO}`}>
              {loading && <Spinner />}
              {loading ? "Autenticando..." : "Entrar na plataforma"}
            </button>
          </form>

          <p className="mt-8 flex items-center gap-2 text-xs text-slate-500">
            <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Conexão segura. A sessão é renovada automaticamente enquanto você usa a plataforma.
          </p>
        </div>
      </div>
    </div>
  )
}

/** A régua de cobrança como assinatura da marca: marcas nos dias em que a cobrança age. */
function ReguaDecorativa() {
  const marcas = [
    { dia: 1, x: 6 },
    { dia: 5, x: 24 },
    { dia: 15, x: 48 },
    { dia: 30, x: 72 },
    { dia: 60, x: 94 },
  ]
  return (
    <div className="mt-14 relative h-14" aria-hidden="true">
      <span className="absolute inset-x-0 top-3 h-px bg-white/25" />
      {marcas.map((m, i) => (
        <span key={m.dia} className="absolute top-0 -translate-x-1/2 flex flex-col items-center" style={{ left: `${m.x}%` }}>
          <span className={`w-[7px] h-[7px] mt-[9px] rounded-full ${i === marcas.length - 1 ? "bg-white" : "border border-white/70 bg-tinta"}`} />
          <span className="mt-2 text-xs text-white/55">D+{m.dia}</span>
        </span>
      ))}
    </div>
  )
}
