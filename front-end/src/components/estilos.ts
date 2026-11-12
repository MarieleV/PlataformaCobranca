// Classes Tailwind compartilhadas (fora dos arquivos de componente, por causa do hot reload).

const INPUT = "w-full px-3 py-2.5 rounded-xl border bg-white text-sm text-slate-900 outline-none focus:ring-4 transition-all"

/** Classes de input/select/textarea, com borda vermelha quando há erro. */
export const inputClasse = (erro?: string | null) =>
  `${INPUT} ${erro ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500/10" : "border-slate-200 focus:border-black focus:ring-black/5"}`
