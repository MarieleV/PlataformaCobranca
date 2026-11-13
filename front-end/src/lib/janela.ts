// Janela de disparo (RN05), calculada no front só para informar a tela.
// Espelha o Celery Beat (back-end/app/core/celery_app.py): a cada 5 minutos,
// seg–sex, das 8h às 19h55, horário de Brasília. Feriados nacionais também
// bloqueiam o disparo, mas o front não conhece o calendário: a tela avisa.

const FUSO = "America/Sao_Paulo"
const HORA_INICIO = 8
const HORA_FIM = 20 // último ciclo às 19:55
const PASSO_MIN = 5

const DIAS = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."]

const partesFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: FUSO, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
})
const INDICE_DIA: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

/** Dia da semana (0 = domingo) e minutos desde 00:00, no horário de Brasília. */
function emBrasilia(agora: Date): { diaSemana: number; minutos: number } {
  const p = Object.fromEntries(partesFmt.formatToParts(agora).map((x) => [x.type, x.value]))
  return { diaSemana: INDICE_DIA[p.weekday], minutos: Number(p.hour) * 60 + Number(p.minute) }
}

const util = (dia: number) => dia >= 1 && dia <= 5
const hhmm = (minutos: number) =>
  `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`

export interface EstadoJanela {
  aberta: boolean
  /** Ex.: "Próximo ciclo às 09:40" ou "Abre seg. às 08:00" */
  detalhe: string
}

export function estadoJanela(agora: Date = new Date()): EstadoJanela {
  const { diaSemana, minutos } = emBrasilia(agora)
  const inicio = HORA_INICIO * 60
  const fim = HORA_FIM * 60

  // Os ciclos rodam nos minutos múltiplos de 5; o seguinte é o próximo múltiplo após agora
  const proximo = Math.ceil((minutos + 1) / PASSO_MIN) * PASSO_MIN
  if (util(diaSemana) && minutos >= inicio && proximo < fim) {
    return { aberta: true, detalhe: `Próximo ciclo às ${hhmm(proximo)}` }
  }

  // Fechada: hoje mais tarde (antes das 8h num dia útil) ou no próximo dia útil
  if (util(diaSemana) && minutos < inicio) {
    return { aberta: false, detalhe: `Abre hoje às ${hhmm(inicio)}` }
  }
  let dia = diaSemana
  let saltos = 0
  do {
    dia = (dia + 1) % 7
    saltos++
  } while (!util(dia))
  return { aberta: false, detalhe: `Abre ${saltos === 1 ? "amanhã" : DIAS[dia]} às ${hhmm(inicio)}` }
}
