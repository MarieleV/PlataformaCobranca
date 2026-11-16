// Classes Tailwind compartilhadas (fora dos arquivos de componente, por causa do hot reload).
//
// Escala do sistema visual:
// - Espaço: base de 4px. Página 16/24/32px, entre seções 24px, painel 20/24px, campos 16px.
// - Raio: 6px (badge/chip), 8px (input/botão), 12px (painel), 16px (modal).
// - Tipo: 12 (legenda) · 13 (tabela/rótulo) · 14 (corpo) · 16 (painel) · 20 (página) · 30 (KPI).

const CAMPO =
  "w-full h-10 px-3 rounded-lg border bg-white text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-[border-color,box-shadow] disabled:bg-slate-50 disabled:text-slate-500"

const CAMPO_OK = "border-slate-300 hover:border-slate-400 focus:border-tinta focus:ring-2 focus:ring-slate-900/10"
const CAMPO_ERRO = "border-rose-400 focus:border-rose-600 focus:ring-2 focus:ring-rose-600/15"

/** Classes de input/select, com borda vermelha quando há erro. Textareas: somar `h-auto py-2.5`. */
export const inputClasse = (erro?: string | null) => `${CAMPO} ${erro ? CAMPO_ERRO : CAMPO_OK}`

/** Select nativo com espaço para a seta desenhada por cima. */
export const SELECT = `${inputClasse()} appearance-none pr-9 cursor-pointer`

/** Rótulo pequeno acima de um campo de filtro ou de um dado. */
export const ROTULO = "block text-[13px] font-medium text-slate-600 mb-1.5"

/** Contêiner de rolagem de cada página. */
export const PAGINA = "h-full overflow-y-auto px-4 py-5 md:px-6 md:py-6 xl:px-8 xl:py-8"
/** Conteúdo da página: largura máxima e respiro entre seções. */
export const CONTEUDO = "mx-auto w-full max-w-[1440px] space-y-6"

/** Superfície branca com borda (painéis, tabelas). */
export const SUPERFICIE = "bg-white rounded-xl border border-slate-200"

// --- Tabelas ---------------------------------------------------------------

export const TABELA = "w-full text-left text-[13px] whitespace-nowrap"
export const THEAD = "border-b border-slate-200 bg-slate-50/70"
export const TH = "px-4 first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6 h-10 text-xs font-medium text-slate-500"
export const TH_NUM = `${TH} text-right`
export const TBODY = "divide-y divide-slate-100 text-slate-700"
export const TD = "px-4 first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6 py-3"
/** Célula numérica: alinhada à direita (os números já são tabulares). */
export const TD_NUM = `${TD} text-right`
/** Linha clicável (abre um detalhe). */
export const TR_CLICAVEL = "cursor-pointer transition-colors hover:bg-slate-50 focus-visible:bg-slate-50"

/** Identificadores (CPF/CNPJ mascarado, IDs, e-mails técnicos). */
export const ID = "font-mono text-xs text-slate-500"
