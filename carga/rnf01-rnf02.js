// Teste de carga dos RNF01 e RNF02 (k6).
//
// RNF01: suportar ao menos 100 usuários simultâneos sem degradação
//        -> 100 usuários virtuais navegando ao mesmo tempo, com menos de 1% de erros.
// RNF02: tempo de resposta das rotas da API < 300 ms no P95
//        -> limite (threshold) p(95) < 300 ms nas requisições da API.
//
// Se algum limite não for atendido, o k6 termina com código de saída 99 e marca o
// limite como reprovado no resumo. Como rodar: carga/README.md.
//
// Variáveis de ambiente:
//   BASE_URL  endereço da API (padrão: http://host.docker.internal:8000, a API local vista de dentro do Docker)
//   EMAIL     usuário para o login (obrigatório)
//   SENHA     senha desse usuário (obrigatória; nunca é impressa)
//   VUS       usuários simultâneos no patamar (padrão: 100)
//   DURACAO   tempo no patamar (padrão: 3m; máximo de 12m, pois o token de acesso vale 15 min)
//   PAUSA_MIN, PAUSA_MAX  pausa entre as ações de cada usuário, em segundos (padrão: 5 a 15)
//
// Ritmo dos usuários: "100 usuários simultâneos" (RNF01) são 100 pessoas com o painel
// aberto ao mesmo tempo, que leem a tabela ou o gráfico entre um clique e outro. A pausa
// padrão de 5 a 15 s (média de 10 s) é mais agressiva que a atualização automática do
// próprio front (Dashboard a cada 60 s, Monitoramento a cada 15 s), então o cenário
// continua conservador. Com PAUSA_MIN=1 PAUSA_MAX=3 o script vira um teste de estresse
// (~4x mais requisições); ver "Ritmo dos usuários" no carga/README.md.

import http from "k6/http"
import { check, fail, sleep } from "k6"
import { textSummary } from "https://jslib.k6.io/k6-summary/0.1.0/index.js"

const BASE_URL = (__ENV.BASE_URL || "http://host.docker.internal:8000").replace(/\/+$/, "")
const VUS = Number(__ENV.VUS || 100)
const DURACAO = __ENV.DURACAO || "3m"
const PAUSA_MIN = Number(__ENV.PAUSA_MIN || 5)
const PAUSA_MAX = Number(__ENV.PAUSA_MAX || 15)
if (!(PAUSA_MIN >= 0 && PAUSA_MAX >= PAUSA_MIN)) {
  throw new Error(`Pausa inválida: PAUSA_MIN=${__ENV.PAUSA_MIN} PAUSA_MAX=${__ENV.PAUSA_MAX}`)
}

export const options = {
  scenarios: {
    usuarios_simultaneos: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: VUS }, // sobe gradualmente até o patamar
        { duration: DURACAO, target: VUS }, // patamar: é aqui que o RNF01/RNF02 é medido
        { duration: "15s", target: 0 }, // desce
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    // RNF02: só as requisições da API (o login do setup fica de fora; ver README)
    "http_req_duration{tipo:api}": ["p(95)<300"],
    // RNF01: "sem degradação" = praticamente nenhuma requisição falhando
    "http_req_failed{tipo:api}": ["rate<0.01"],
    checks: ["rate>0.99"],
  },
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
}

// Login uma única vez; todos os usuários virtuais usam a mesma sessão.
// Motivo: o login usa bcrypt (lento de propósito, contra força bruta), e 100 logins no
// mesmo segundo mediriam o bcrypt, não a navegação que o RNF02 descreve.
export function setup() {
  if (!__ENV.EMAIL || !__ENV.SENHA) {
    fail("Informe EMAIL e SENHA (ex.: -e EMAIL=... -e SENHA=...). Veja carga/README.md.")
  }
  const resposta = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: __ENV.EMAIL, password: __ENV.SENHA }),
    { headers: { "Content-Type": "application/json" }, tags: { tipo: "login" } },
  )
  if (resposta.status !== 200) {
    fail(`Login falhou (HTTP ${resposta.status}) em ${BASE_URL}. Confira EMAIL/SENHA e se a API está no ar.`)
  }
  const cookie = resposta.cookies.access_token
  if (!cookie || !cookie.length) fail("A API não devolveu o cookie access_token.")
  return { token: cookie[0].value }
}

const DIAS = [7, 15, 30]
const STATUS = ["ativo", "comunicado", "negociando"]
const ATRASOS = [1, 15, 30, 60]
const CANAIS = ["email", "sms", "whatsapp"]
const BUSCAS = ["Silva", "Santos", "Oliveira", "Souza", "Ana", "Carlos", "Maria"]

const sorteio = (lista) => lista[Math.floor(Math.random() * lista.length)]

// Rotas que um usuário do painel usa, com peso proporcional ao uso esperado.
// "name" agrupa as variações de query string numa linha só do resumo.
const ACOES = [
  { peso: 25, name: "GET /dashboard", url: () => `/dashboard/?dias=${sorteio(DIAS)}` },
  { peso: 20, name: "GET /devedores", url: () => `/devedores/?skip=${50 * Math.floor(Math.random() * 5)}&limit=50` },
  { peso: 10, name: "GET /devedores (filtros)", url: () => `/devedores/?status=${sorteio(STATUS)}&atraso_minimo=${sorteio(ATRASOS)}&canal=${sorteio(CANAIS)}&limit=50` },
  { peso: 10, name: "GET /devedores (busca)", url: () => `/devedores/?busca=${sorteio(BUSCAS)}&limit=50` },
  { peso: 8, name: "GET /regras", url: () => "/regras/" },
  { peso: 5, name: "GET /regras/status", url: () => "/regras/status" },
  { peso: 10, name: "GET /jobs", url: () => "/jobs/?limit=20" },
  { peso: 7, name: "GET /lotes", url: () => "/lotes/?limit=50" },
  { peso: 5, name: "GET /auth/me", url: () => "/auth/me" },
]
const PESO_TOTAL = ACOES.reduce((soma, a) => soma + a.peso, 0)

function escolherAcao() {
  let n = Math.random() * PESO_TOTAL
  for (const acao of ACOES) {
    n -= acao.peso
    if (n < 0) return acao
  }
  return ACOES[0]
}

export default function (dados) {
  const acao = escolherAcao()
  const resposta = http.get(`${BASE_URL}${acao.url()}`, {
    headers: { Cookie: `access_token=${dados.token}` },
    tags: { tipo: "api", name: acao.name },
  })
  check(resposta, {
    "status 200": (r) => r.status === 200,
  })
  // Tempo de leitura da tela entre um clique e outro (padrão: 5 a 15 s; ver o cabeçalho)
  sleep(PAUSA_MIN + Math.random() * (PAUSA_MAX - PAUSA_MIN))
}

// Resumo no terminal e cópia em JSON (carga/resultados/), para anexar ao TCC.
export function handleSummary(resumo) {
  const quando = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
  // Produção é sempre HTTPS; o resto (api:8000, localhost, host.docker.internal) é local
  const alvo = BASE_URL.startsWith("https://") ? "remoto" : "local"
  // A configuração vai junto do resumo: sem ela o número não é comparável (evidência do TCC)
  const configuracao =
    `Configuração: ${VUS} usuários, patamar de ${DURACAO}, pausa de ${PAUSA_MIN} a ${PAUSA_MAX} s, alvo ${alvo}\n`
  return {
    stdout: configuracao + textSummary(resumo, { indent: " ", enableColors: true }),
    [`resultados/rnf01-rnf02-${alvo}-${quando}.json`]: JSON.stringify(
      { configuracao: { VUS, DURACAO, PAUSA_MIN, PAUSA_MAX, alvo }, ...resumo },
      null,
      2,
    ),
    [`resultados/rnf01-rnf02-${alvo}-${quando}.txt`]: configuracao + textSummary(resumo, { indent: " ", enableColors: false }),
  }
}
