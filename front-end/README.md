# Front-end — Plataforma de Cobrança Automatizada

React 19 + Vite 8 + TypeScript + Tailwind CSS v4 (+ Recharts para gráficos).
O layout nasceu no Figma Make e ainda está em evolução.

## Pré-requisitos

- Node.js 22 LTS (inclui o npm).
- Back-end no ar (`docker compose up -d --build` na pasta `back-end`) e o seed aplicado
  (`docker exec -it cobranca_api python -m app.seed` → `admin@consulth.com.br` / `admin123`).

## Como rodar (PowerShell)

```powershell
cd front-end
Copy-Item .env.example .env   # só na primeira vez
npm install                   # só na primeira vez / quando o package.json mudar
npm run dev                   # http://localhost:8443
```

| Script | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento na porta 8443 (hot reload) |
| `npm run lint` | ESLint (TypeScript + hooks do React); falha com qualquer aviso |
| `npm run typecheck` | Checagem de tipos do TypeScript (inclui os testes) |
| `npm test` | Testes unitários (Vitest), uma vez |
| `npm run test:watch` | Testes em modo observação, enquanto programa |
| `npm run test:coverage` | Testes com cobertura (mínimo de 80%); relatório HTML em `coverage/` |
| `npm run verificar` | Tudo o que o CI roda: lint, tipos, testes com cobertura e build |
| `npm run build` | Build de produção em `dist/` |
| `npm run preview` | Serve o build de produção localmente |

## Testes e CI

- Testes em `src/**/*.test.ts(x)` (Vitest + jsdom + Testing Library). Cobrem a lógica: cliente HTTP
  (`api.ts`: refresh em 401, refresh único para chamadas simultâneas, mensagens de erro), `AuthContext`,
  `useApi` (polling e `pararQuando`), formatadores, janela de disparo e validações. As telas são
  validadas pelo `ROTEIRO_TESTES.md`.
- Ao mockar o `apiFetch`, crie um `vi.fn()` novo por teste (no `beforeEach`) em vez de `mockReset()`:
  no Vitest 5 o reset faz promises rejeitadas pelo mock virarem "unhandled rejection".
- O job **"Front-end (lint, tipos, testes e build)"** do `.github/workflows/ci.yml` roda `npm ci` e os
  mesmos scripts do `verificar`, com Node 22.
- `npm audit` acusa vulnerabilidades *moderate* no `minimatch` usado pelo ESLint: só ferramenta de
  desenvolvimento (não vai para o bundle) e o conserto exige `--force` com versões incompatíveis.
  `npm audit --omit=dev` deve ficar zerado.

## Integração com a API

- A URL da API vem de `VITE_API_URL` (`.env`); padrão `http://localhost:8000`.
- Autenticação por **cookies httpOnly** gravados pelo back-end: o JavaScript não vê o token.
  Todas as chamadas passam por `apiFetch` (`src/lib/api.ts`), que envia `credentials: "include"`,
  renova a sessão uma vez em caso de 401 (`POST /auth/refresh`) e devolve `ApiError` com
  mensagem pronta para a tela.
- **Use sempre `localhost`** (no navegador e no `VITE_API_URL`). Misturar `localhost` com
  `127.0.0.1` faz o navegador tratar como sites diferentes e não enviar os cookies.
- A origem do front precisa estar em `CORS_ORIGINS` no `.env` do back-end
  (`http://localhost:8443` já está no padrão).
- Formatos de request/response: `http://localhost:8000/docs` ou `/openapi.json`.

## Estrutura

```
src/
├── main.tsx              # monta o App dentro do AuthProvider
├── App.tsx               # verifica a sessão, mostra Login ou a área logada (navegação por estado)
├── auth/
│   ├── AuthContext.tsx   # useAuth(): usuario, login, logout, recarregarUsuario, pode(perfis)
│   └── permissoes.ts     # páginas e ações x perfis (espelha o RBAC do back-end)
├── lib/
│   ├── api.ts            # cliente HTTP (cookies, refresh, erros, download, /health)
│   ├── tipos.ts          # tipos da API
│   ├── formatos.ts       # números, R$, CPF/CNPJ, datas em Brasília, rótulos de status
│   └── lotes.ts, regua.ts, janela.ts, jobs.ts, usuarios.ts  # regras de cada domínio
├── hooks/                # useApi (GET + polling), useSaude, useDebounce, useFecharComEsc
├── components/           # Sidebar, ui.tsx (Badge, Painel, Modal...), painéis e modais
├── pages/                # uma tela por arquivo
└── test/setup.ts         # configuração do Vitest
```

## Convenções

- Estilo com classes do Tailwind direto no JSX; CSS global em `src/index.css`.
- Componentes exportados como `default`.
- **LGPD:** não registre CPF/CNPJ nem corpos de requisição no console.
