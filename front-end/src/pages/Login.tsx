import { useState } from "react"

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
      <div className="hidden lg:flex flex-col justify-between w-[480px] bg-slate-900 p-12 text-white flex-shrink-0">
        <div>
          {/* Logo e Empresa */}
          <div className="flex items-center gap-4 mb-16">
            <div className="bg-blue-600 rounded-lg w-10 h-10 flex items-center justify-center font-bold text-sm tracking-wider shadow-lg shadow-blue-600/20">
              CA
            </div>
            <div>
              <p className="font-bold text-lg leading-tight">Cobrança Automatizada</p>
              <p className="text-xs text-slate-400 font-medium">Consulth Soluções Empresariais</p>
            </div>
          </div>

          {/* Título de Impacto */}
          <h1 className="text-4xl font-bold leading-tight mb-6 tracking-tight">
            Gestão de cobrança escalável e auditável.
          </h1>
          <p className="text-slate-300 leading-relaxed text-sm">
            Automatize o ciclo completo de inadimplência — da ingestão de dados ao disparo multicanal — com rastreabilidade total e zero intervenção manual.
          </p>
        </div>

        {/* Métricas de Credibilidade */}
        <div className="space-y-3">
          {[
            { metric: "70M+", label: "Inadimplentes no Brasil (Serasa)" },
            { metric: "10k", label: "Registros por minuto processados" },
            { metric: "95%+", label: "Taxa de entrega de e-mails" },
          ].map((s) => (
            <div 
              key={s.metric}
              className="flex items-center gap-4 px-5 py-4 rounded-xl bg-white/[0.03] border border-white/10 backdrop-blur-sm transition-colors hover:bg-white/[0.05]"
            >
              <span className="font-bold text-2xl text-blue-400 min-w-[70px]">
                {s.metric}
              </span>
              <span className="text-sm text-slate-300 font-medium">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* --- PAINEL DIREITO (Formulário) --- */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-[420px]">
          
          {/* Cabeçalho do Formulário */}
          <div className="mb-10 text-center ou text-left">
            <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">
              Acessar plataforma
            </h2>
            <p className="text-sm text-slate-500">
              Insira suas credenciais corporativas para continuar.
            </p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-5 bg-white p-8 rounded-2xl shadow-sm border border-slate-200/60">
            
            {/* Input E-mail */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-semibold text-slate-700">
                E-mail corporativo
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="analista@empresa.com.br"
                className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Input Senha */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-semibold text-slate-700">
                  Senha
                </label>
                <a href="#" className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                  Esqueceu a senha?
                </a>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Mensagem de Erro */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
                <p className="text-xs font-medium text-red-600 text-center">{error}</p>
              </div>
            )}

            {/* Botão Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 mt-2 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-md shadow-blue-600/20 flex justify-center items-center gap-2"
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
          <p className="text-xs text-slate-400 mt-8 text-center flex items-center justify-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Autenticação segura via JWT · Sessão expira em 15 min
          </p>
        </div>
      </div>
    </div>
  )
}