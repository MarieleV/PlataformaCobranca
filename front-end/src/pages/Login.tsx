import { useState } from "react"
// Correção: Usando ../ para voltar para a raiz da src e achar a pasta assets
import logoTcc from "../assets/logo-tcc.png"

interface LoginProps {
  onLogin: () => void
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    
    if (!email || !password) {
      setError("Por favor, preencha todos os campos para continuar.")
      return
    }
    
    setLoading(true)
    // Simulando chamada à API
    setTimeout(() => {
      setLoading(false)
      onLogin()
    }, 1200)
  }

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans">
      
      {/* --- PAINEL ESQUERDO (Branding & Valor) --- */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] bg-black p-12 text-white flex-shrink-0">
        <div>
          {/* Logo e Empresa */}
          <div className="flex items-center gap-4 mb-16">
            
            {/* CAIXA DA LOGO */}
            <div className="bg-white rounded-xl w-11 h-11 flex items-center justify-center shadow-lg shadow-white/10 overflow-hidden">
              <img 
                src={logoTcc} 
                alt="Logo Cobrança Automatizada" 
                className="w-full h-full object-contain p-1.5" 
              />
            </div>

            <div>
              <p className="font-bold text-lg leading-tight tracking-tight">Cobrança Automatizada</p>
              <p className="text-xs text-white/60 font-medium tracking-wide">CONSULTH SOLUÇÕES</p>
            </div>
          </div>

          {/* Título de Impacto */}
          <h1 className="text-4xl font-bold leading-tight mb-6 tracking-tight">
            Escale sua recuperação de crédito com segurança total.
          </h1>
          <p className="text-white/70 leading-relaxed text-sm font-medium">
            Automatize todo o ciclo de cobrança: da integração de dados ao acionamento multicanal. Tenha rastreabilidade ponta a ponta com zero intervenção manual.
          </p>
        </div>

        {/* Métricas de Credibilidade */}
        <div className="space-y-3">
          {[
            { metric: "70M+", label: "Inadimplentes no Brasil (Serasa)" },
            { metric: "10k", label: "Registros processados por minuto" },
            { metric: "95%+", label: "Taxa de entrega multicanal" },
          ].map((s) => (
            <div 
              key={s.metric}
              className="flex items-center gap-5 px-6 py-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md transition-all hover:bg-white/10 cursor-default"
            >
              <span className="font-bold text-2xl text-white min-w-[70px] tracking-tight">
                {s.metric}
              </span>
              <span className="text-sm text-white/70 font-medium leading-tight">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* --- PAINEL DIREITO (Formulário) --- */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-[420px]">
          
          {/* Cabeçalho do Formulário */}
          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">
              Acessar plataforma
            </h2>
            <p className="text-sm text-slate-500 font-medium">
              Insira suas credenciais corporativas para continuar.
            </p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-5 bg-white p-8 rounded-3xl shadow-sm border border-slate-200/60">
            
            {/* Input E-mail */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-bold text-slate-900">
                E-mail corporativo
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="analista@empresa.com.br"
                className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 text-sm focus:bg-white focus:border-black focus:ring-4 focus:ring-black/5 outline-none transition-all placeholder:text-slate-400 font-medium"
              />
            </div>

            {/* Input Senha */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-bold text-slate-900">
                  Senha
                </label>
                <a href="#" className="text-xs font-bold text-slate-500 hover:text-black transition-colors">
                  Esqueceu a senha?
                </a>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 text-sm focus:bg-white focus:border-black focus:ring-4 focus:ring-black/5 outline-none transition-all placeholder:text-slate-400 font-medium"
              />
            </div>

            {/* Mensagem de Erro */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl">
                <p className="text-xs font-bold text-red-600 text-center">{error}</p>
              </div>
            )}

            {/* Botão Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 mt-4 rounded-xl text-sm font-bold text-white bg-black hover:bg-slate-900 active:scale-[0.99] transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-xl shadow-black/10 flex justify-center items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Autenticando...
                </>
              ) : (
                "Entrar na plataforma"
              )}
            </button>
          </form>

          {/* Rodapé de Segurança */}
          <div className="mt-8 flex flex-col items-center justify-center gap-2 text-center">
            <p className="text-xs font-medium text-slate-400 flex items-center justify-center gap-1.5">
              <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Ambiente seguro e criptografado
            </p>
            <p className="text-[11px] font-mono text-slate-300">
              Sessão expira em 15 minutos de inatividade
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}