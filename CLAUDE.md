# CLAUDE.md — Plataforma de Cobrança Automatizada (TCC)

Contexto do projeto para o Claude Code. Leia este arquivo inteiro antes de mexer em qualquer coisa.

## O projeto
TCC da Mariele (Católica SC), com a empresa parceira Consulth. Sistema de cobrança automatizada: importa lotes de devedores (csv/xlsx/xls), aplica uma **régua de cobrança** (regras por dias de atraso, canal e horário) e dispara mensagens por **e-mail (SendGrid), SMS e WhatsApp (Twilio)**, com reenvios, dashboard e métricas. Documento de requisitos: `docs/RFC` (RFC v1.1; os códigos RF/RN/RNF citados abaixo vêm dele).

Repositório (raiz = esta pasta): `back-end/` (FastAPI) e `front-end/` (a integrar). **O back-end está concluído e mergeado na `main`; a etapa atual é o front-end.**

## Como trabalhar com a Mariele
- Responda em **português do Brasil**, direto e prático. Ela usa **Windows + PowerShell** (caminhos como `C:\Users\silva\Repositórios GitHub\tcc-cobranca\PlataformaCobranca`); dê comandos que funcionem em PowerShell.
- Para cada etapa ela espera: **nome de branch** (git-flow: `feature/...`, `hotfix/...`), **árvore de pastas/arquivos** com `← NOVO` / `← SUBSTITUI`, **commits no padrão Conventional Commits** e instruções claras de teste.
- Commits: use `git add` por nome de arquivo (nada de `git add .` sem olhar o `git status`). Mesmo que você, Claude me ajude, peço que não cite nos commits Co-Authored-By ou Claude-Session.
- Fluxo de branches: `feature/*` → `develop` (merge local com `--no-ff`) → PR `develop` → `main`. A `main` é protegida por Ruleset ("Proteção da Main"): exige PR e os checks `Testes e SonarCloud`, `Migrações no PostgreSQL` e `Build da imagem Docker`. Não use bypass.
- Se algo for ambíguo e caro de refazer, pergunte antes. Se for barato de refazer, decida, diga a decisão e siga.

## CI/CD (já funcionando)
`.github/workflows/ci.yml`: testes (cobertura mínima 80%), migrações em PostgreSQL 15, build do Docker e SonarCloud com Quality Gate (só em PRs e na `main`; o plano gratuito não analisa outras branches). Se o front-end ganhar testes/lint, **acrescente jobs ao `ci.yml`** e inclua os nomes novos nos checks obrigatórios do Ruleset. O Deploy é um passo de aviso (AWS ainda não feita).

## Back-end em uma página
- Python 3.14, FastAPI, SQLAlchemy 2.1, Alembic (migrações `0001`–`0005`, aplicadas ao subir a API), PostgreSQL 15, Redis, RabbitMQ, Celery (worker + beat). Tudo em Docker Compose (`back-end/docker-compose.yml`): `docker compose up -d --build` na pasta `back-end`. API em `http://localhost:8000`, docs interativas em `/docs`, esquema em `/openapi.json` (**fonte da verdade dos formatos de request/response** — consulte-o em vez de adivinhar).
- Seed (admin de desenvolvimento): `docker exec -it cobranca_api python -m app.seed` → `admin@consulth.com.br` / `admin123`.
- Testes do back-end: no venv (`venv\Scripts\Activate.ps1`), `pytest` em `back-end/` (783 testes, ~97% de cobertura). Dependências de teste em `requirements-dev.txt`.
- Envio real **desligado** por padrão (`ENVIO_SIMULADO=true`): o cliente simulado trata e-mail começando com `bounce` ou telefone terminando em `0000` como bounce e e-mail `falha...`/telefone `...9999` como falha temporária; o resto é "enviado". Ótimo para demonstrar o front.

### Autenticação (importante para o front)
- Login: `POST /auth/login` com JSON `{"email": ..., "password": ...}` (resposta: `{message, user:{id,nome,email,perfil}}`). O servidor **grava dois cookies httpOnly** (access, 15 min; refresh, 7 dias, com `path=/auth`). **O JavaScript não vê o token.**
- O front deve enviar as requisições com **`credentials: 'include'`** (fetch) ou `withCredentials: true` (axios). CORS já está com `allow_credentials=True`; as origens permitidas vêm de `CORS_ORIGINS` no `.env` (padrão: `http://localhost:8443`, `http://localhost:5173`, `http://127.0.0.1:8443`). **Nunca** use `*`.
- `POST /auth/refresh` renova (rotação do refresh); `DELETE /auth/logout`; `GET /auth/me` devolve o usuário logado; `PUT /auth/senha` troca a própria senha. Em 401, tente um refresh uma vez e, se falhar, volte ao login.
- Senha: 8–128 caracteres com ao menos uma letra e um número. Tentativas de login em excesso (5 falhas) são bloqueadas por um tempo com HTTP 429.
- Perfis (RBAC, RN06): `administrador`, `gestor`, `operador`. **No JSON o campo se chama `perfil`** (no banco é `cargo`).

### Endpoints (todos exigem login, salvo `/`, `/health` e `/metrics`)
| Área | Rotas | Quem |
|---|---|---|
| Auth | `POST /auth/login`, `POST /auth/refresh`, `DELETE /auth/logout`, `GET /auth/me`, `PUT /auth/senha` | login público; demais autenticados |
| Lotes | `POST /lotes/upload` (multipart, campo `file`; 422 formato/vazio, 413 grande), `GET /lotes/`, `GET /lotes/{id}`, `GET /lotes/{id}/erros`, `GET /lotes/{id}/erros/csv` | todos os perfis |
| Devedores | `GET /devedores/` (query: `status`, `atraso_minimo`, `busca` [nome ou CPF/CNPJ, mín. 2 caracteres], `skip`, `limit` ≤ 200), `GET /devedores/{id}`, `GET /devedores/{id}/comunicacoes`, `PATCH /devedores/{id}/status`, `DELETE /devedores/{id}` (LGPD) | leitura: todos; **excluir: só administrador**; **marcar `quitado`: só gestor/administrador**; quitado não reabre (409) |
| Usuários | `GET/POST /usuarios/`, `GET/PATCH/DELETE /usuarios/{id}`, `POST /usuarios/{id}/ativar`, `/desativar`, `/redefinir-senha` | gestor (só gerencia operadores) e administrador (todos); operador não acessa |
| Auditoria | `GET /auditoria/` (filtros `usuario_id`, `acao`, `entidade`, `de`, `ate`) | só administrador |
| Régua | `GET/POST /regras/`, `GET/PATCH/DELETE /regras/{id}`, `POST /regras/{id}/ativar` e `/desativar`, `GET /regras/status`, `GET /regras/variaveis`, `POST /regras/preview`, `GET /regras/{id}/elegiveis`, `POST /regras/{id}/executar` (202) | gestor e administrador (listar/consultar: todos) |
| Jobs | `GET /jobs/`, `GET /jobs/{id}`, `GET /jobs/{id}/comunicacoes` | todos os perfis |
| Dashboard | `GET /dashboard/?dias=7` (1–30) | todos os perfis |
| Infra | `GET /health` (Postgres/Redis/RabbitMQ), `GET /metrics` (Prometheus) | públicos (o `/metrics` pode exigir `METRICS_TOKEN`) |

Confirme os perfis exatos de cada rota em `back-end/app/api/*.py` (`role_required`) e os campos em `back-end/app/schemas/*.py`.

### Regras de negócio que a tela precisa respeitar
- **Régua (RF04/UC03):** regra = canal (`email|sms|whatsapp`) + `dias_atraso` + `horario_disparo` (entre 08:00 e 20:00) + template. **Nasce inativa.** Só **uma regra ativa por (canal, dias_atraso)** (409 se já houver). Templates aceitam as variáveis `{nome}`, `{primeiro_nome}`, `{valor}`, `{data_vencimento}`, `{dias_atraso}` (liste em `GET /regras/variaveis`; valide/pré-visualize com `POST /regras/preview`). Limites: SMS 480, WhatsApp 1024, e-mail 5000 caracteres.
- **Elegibilidade:** atraso **exatamente** igual ao da regra; devedor com status `ativo` ou `comunicado`; contato para o canal; no máximo uma comunicação bem-sucedida por canal por dia (RN03).
- **Disparo:** o Celery Beat roda a cada 5 min, seg–sex, 8h–19h (Brasília), **sem feriados** (RN05). Reenvios: até 4 tentativas, 30 min entre elas (RN07); e-mail/telefone inválido = `bounce`, falha definitiva (RN08). `POST /regras/{id}/executar` dispara manualmente (até 7 dias para trás; 409 se o job do dia já existe).
- **Status do devedor:** `ativo`, `comunicado`, `negociando`, `quitado`, `inativo`. Comunicação: `pendente`, `enviado`, `entregue` (reservado a webhooks futuros), `falha`, `bounce`.
- **Lote:** processamento assíncrono. Após o upload, **faça polling** em `GET /lotes/{id}` até o status terminar (campo de progresso percentual); mostre os erros por linha e o CSV de erros. Reimportar um CPF/CNPJ existente **atualiza** o devedor (contador `total_atualizados`); devedor quitado é rejeitado.
- **Dashboard (RF08):** taxa de entrega = sucesso ÷ todas as comunicações geradas no período; taxa de conversão = devedores alcançados que hoje estão quitados; meta de entrega 95% (`meta_taxa_entrega`). Taxas podem vir `null` quando não há base — trate na tela. Não há valores em R$ (o valor da dívida é criptografado).
- O valor da dívida vem descriptografado no `DevedorResponse`. CPF/CNPJ é dado pessoal (LGPD): não registre em logs do front.

## Front-end (em andamento)
React 19 + Vite 8 + TypeScript + Tailwind v4 + Recharts, porta 8443. Detalhes em `front-end/README.md`. O protótipo de UX do RFC descreve: KPIs consolidados (devedores na base, disparos do dia, taxa de entrega, falhas), distribuição por canal, linha do tempo de 7 dias, últimos lotes e atalhos.

Decisões já tomadas com a Mariele:
- **Chamadas direto em `http://localhost:8000`** (`VITE_API_URL`), sem proxy do Vite: o cookie de refresh tem `path=/auth`, e um proxy com prefixo (`/api/auth/refresh`) faria o navegador não enviá-lo. Sempre `localhost`, nunca misturar com `127.0.0.1`.
- Todo acesso à API passa por `apiFetch` (`src/lib/api.ts`); sessão em `useAuth()` (`src/auth/AuthContext.tsx`); páginas × perfis em `src/auth/permissoes.ts`.
- `fetch` nativo (sem axios); tipos da API escritos à mão em `src/lib/tipos.ts`, conferidos no `/openapi.json`.
- Navegação por `useState` (sem `react-router` por enquanto; pode entrar depois).
- O layout atual **não é o final** e não há Figma atualizado: pode melhorar a UI, mantendo a identidade (preto/branco/slate).
- Origem do front: só `http://localhost:8443` por enquanto.

Plano por etapas (uma `feature/*` cada): 1 `front-auth-login` → 2 `front-dashboard` → 3 `front-lotes` (upload + polling + relatório de validação) → 4 `front-devedores` → 5 `front-regua` → 6 `front-monitoramento` (jobs) → 7 `front-usuarios` (+ auditoria e troca de senha) → 8 `front-ci` (ESLint, `tsc`, Vitest, job no `ci.yml` e no Ruleset). O SonarCloud só analisa `back-end/app`.

## Pendências do projeto (fora do front)
- Teste real do SendGrid/Twilio (`docker compose exec api python -m app.testar_provedores email|sms|whatsapp <destino>`) e autenticação de domínio do remetente, **depois da integração com o front**.
- Deploy na AWS (RDS PostgreSQL, EC2) e o passo de deploy do CI.
- Webhooks de status de entrega (`entregue`) e templates aprovados do WhatsApp (produção).
- Monitoramento opcional: `docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d` (Prometheus :9090, Grafana :3000).

## Documentação
- `back-end/DOC.md`: execução, testes, CI/CD, métricas, regras e limitações conhecidas.
- `docs/RFC`: requisitos (RF/RN/RNF).