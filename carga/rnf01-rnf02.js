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

import http from "k6/http"
import { check, fail, sleep } from "k6"
import { textSummary } from "https://jslib.k6.io/k6-summary/0.1.0/index.js"

const BASE_URL = (__ENV.BASE_URL || "http://host.docker.internal:8000").replace(/\/+$/, "")
const VUS = Number(__ENV.VUS || 100)
const DURACAO = __ENV.DURACAO || "3m"

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
  // Tempo de leitura da tela entre um clique e outro (1 a 3 s), como um usuário real
  sleep(1 + Math.random() * 2)
}

// Resumo no terminal e cópia em JSON (carga/resultados/), para anexar ao TCC.
export function handleSummary(resumo) {
  const quando = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
  const alvo = BASE_URL.includes("host.docker.internal") || BASE_URL.includes("localhost") ? "local" : "remoto"
  return {
    stdout: textSummary(resumo, { indent: " ", enableColors: true }),
    [`resultados/rnf01-rnf02-${alvo}-${quando}.json`]: JSON.stringify(resumo, null, 2),
    [`resultados/rnf01-rnf02-${alvo}-${quando}.txt`]: textSummary(resumo, { indent: " ", enableColors: false }),
  }
}
