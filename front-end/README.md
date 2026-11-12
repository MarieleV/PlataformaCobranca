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
| `npm run typecheck` | Checagem de tipos do TypeScript |
| `npm run build` | Build de produção em `dist/` |
| `npm run preview` | Serve o build de produção localmente |

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
├── App.tsx               # verifica a sessão, mostra Login ou a área logada
├── auth/
│   ├── AuthContext.tsx   # useAuth(): usuario, login, logout, pode(perfis)
│   └── permissoes.ts     # páginas x perfis (espelha o RBAC do back-end)
├── lib/
│   ├── api.ts            # cliente HTTP (cookies, refresh, erros)
│   └── tipos.ts          # tipos da API
├── components/           # Sidebar e componentes reutilizáveis
└── pages/                # uma tela por arquivo
```

## Convenções

- Estilo com classes do Tailwind direto no JSX; CSS global em `src/index.css`.
- Componentes exportados como `default`.
- **LGPD:** não registre CPF/CNPJ nem corpos de requisição no console.
