# CLAUDE.md — Plataforma de Cobrança Automatizada (TCC)

Contexto do projeto para o Claude Code. Leia este arquivo inteiro antes de mexer em qualquer coisa.

## O projeto
TCC da Mariele (Católica SC), com a empresa parceira Consulth. Sistema de cobrança automatizada: importa lotes de devedores (csv/xlsx/xls), aplica uma **régua de cobrança** (regras por dias de atraso, canal e horário) e dispara mensagens por **e-mail (SendGrid), SMS e WhatsApp (Twilio)**, com reenvios, dashboard e métricas. Documento de requisitos: `docs/RFC.md` (RFC v1.1; os códigos RF/RN/RNF citados abaixo vêm dele).

Repositório (raiz = esta pasta): `back-end/` (FastAPI) e `front-end/` (React).

## Situação atual (atualizado em 13/11/2026)
- **Back-end concluído** e na `main`.
- **Front-end concluído**: as 8 etapas de integração foram mergeadas na `develop`, testadas pela Mariele (`front-end/ROTEIRO_TESTES.md`) e levadas à `main` pelo PR #25. `main` e `develop` estão no mesmo commit. Não há mais mocks nas telas.
- **Próxima fase: as pendências do projeto** (seção "Pendências", mais abaixo), começando pelo teste real dos provedores e pelo deploy na AWS.

## Como trabalhar com a Mariele
- Responda em **português do Brasil**, direto e prático. Ela usa **Windows + PowerShell** (o repositório pode estar em pastas diferentes conforme a máquina, ex.: `C:\Users\mariele.vieira\Desktop\TCC\PlataformaCobranca`); dê comandos que funcionem em PowerShell.
- Para cada etapa ela espera: **nome de branch** (git-flow: `feature/...`, `hotfix/...`), **árvore de pastas/arquivos** com `← NOVO` / `← SUBSTITUI`, **commits no padrão Conventional Commits** e instruções claras de teste.
- Commits: use `git add` por nome de arquivo (nada de `git add .` sem olhar o `git status`). Mesmo que você, Claude me ajude, peço que não cite nos commits Co-Authored-By ou Claude-Session.
  - Quem faz os commits é a Mariele: entregue os comandos, não commite por ela.
  - Cuidado com `git mv`/`git rm`: eles já deixam a mudança *staged* e ela entra no próximo commit, seja qual for. E um `git add` com um caminho que não existe mais falha **inteiro** (nenhum arquivo da linha é adicionado). Monte os comandos de commit considerando isso.
- Fluxo de branches: `feature/*` → `develop` (merge local com `--no-ff`) → PR `develop` → `main`. A `main` é protegida por Ruleset ("Proteção da Main"): exige PR e os checks `Testes e SonarCloud`, `Migrações no PostgreSQL`, `Build da imagem Docker` e `Front-end (lint, tipos, testes e build)`. Não use bypass.
- Se algo for ambíguo e caro de refazer, pergunte antes. Se for barato de refazer, decida, diga a decisão e siga.
- **Validação a cada entrega:** rode você mesmo `npm run verificar` (front: lint, tipos, testes com cobertura e build) e/ou `pytest` (back), e teste chamadas reais à API (via `curl` com cookie de sessão) quando mexer em contrato. Ações destrutivas (quitar, excluir) não devem ser testadas na massa dela sem pedir. Mudou comportamento visível na tela? Atualize `front-end/ROTEIRO_TESTES.md`.

## CI/CD (já funcionando)
`.github/workflows/ci.yml`: testes do back (cobertura mínima 80%), migrações em PostgreSQL 15, build do Docker e SonarCloud com Quality Gate (só em PRs e na `main`; o plano gratuito não analisa outras branches; o Sonar só analisa `back-end/app`). Job do front: **`Front-end (lint, tipos, testes e build)`** (Node 22, `npm ci`, `lint` sem avisos, `typecheck`, `test:coverage` com mínimo de 80% e `build`). O Deploy depende dos quatro jobs e é **só um passo de aviso** (AWS ainda não feita). Ao criar um job novo, inclua o nome dele nos checks obrigatórios do Ruleset.

## Back-end em uma página
- Python 3.14, FastAPI, SQLAlchemy 2.1, Alembic (migrações `0001`–`0005`, aplicadas ao subir a API), PostgreSQL 15, Redis, RabbitMQ, Celery (worker + beat). Tudo em Docker Compose (`back-end/docker-compose.yml`): `docker compose up -d --build` na pasta `back-end`. API em `http://localhost:8000`, docs interativas em `/docs`, esquema em `/openapi.json` (**fonte da verdade dos formatos de request/response** — consulte-o em vez de adivinhar).
- Seed (admin de desenvolvimento): `docker exec -it cobranca_api python -m app.seed` → `admin@consulth.com.br` / `admin123` (o seed recusa a senha padrão em produção).
- Máquina com pouca RAM: o RabbitMQ pode demorar a ficar *healthy* (alarme `system_memory_high_watermark` nos logs) e o `up` falhar com "dependency rabbitmq failed to start", deixando api/worker/beat em "Created". Não é defeito: rode `docker compose up -d` de novo (sem `--build`) e, se precisar, pare o monitoramento (`docker stop back-end-grafana-1 back-end-prometheus-1`).
- Testes do back-end: no venv (`venv\Scripts\Activate.ps1`), `pytest` em `back-end/` (783 testes, ~97% de cobertura). Dependências de teste em `requirements-dev.txt`.
- Envio real **desligado** por padrão (`ENVIO_SIMULADO=true`): o cliente simulado trata e-mail começando com `bounce` ou telefone terminando em `0000` como bounce e e-mail `falha...`/telefone `...9999` como falha temporária; o resto é "enviado". Teste dos provedores reais: `docker compose exec api python -m app.testar_provedores email|sms|whatsapp <destino>`.
- Produção (`ENVIRONMENT=production` em `app/core/config.py`): exige `COOKIE_SECURE=true` (HTTPS) e senha do admin diferente da padrão; `COOKIE_SAMESITE` (`lax` padrão) e `CORS_ORIGINS` precisam refletir o domínio real do front.

### Autenticação (importante para o front)
- Login: `POST /auth/login` com JSON `{"email": ..., "password": ...}` (resposta: `{message, user:{id,nome,email,perfil}}`). O servidor **grava dois cookies httpOnly** (access, 15 min; refresh, 7 dias, com `path=/auth`). **O JavaScript não vê o token.**
- O front envia as requisições com **`credentials: 'include'`**. CORS com `allow_credentials=True`; origens em `CORS_ORIGINS` no `.env` (padrão: `http://localhost:8443`, `http://localhost:5173`, `http://127.0.0.1:8443`). **Nunca** use `*`.
- `POST /auth/refresh` renova (rotação do refresh); `DELETE /auth/logout`; `GET /auth/me` devolve o usuário logado; `PUT /auth/senha` troca a própria senha. Em 401, o front tenta um refresh uma vez e, se falhar, volta ao login.
- Senha: 8–128 caracteres com ao menos uma letra e um número. 5 falhas de login → bloqueio temporário (HTTP 429).
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

### Regras de negócio
- **Régua (RF04/UC03):** regra = canal (`email|sms|whatsapp`) + `dias_atraso` + `horario_disparo` (entre 08:00 e 20:00, "a partir de") + template. **Nasce inativa.** Só **uma regra ativa por (canal, dias_atraso)** (409 se já houver). Variáveis: `{nome}`, `{primeiro_nome}`, `{valor}`, `{data_vencimento}`, `{dias_atraso}` (`GET /regras/variaveis`; pré-visualização em `POST /regras/preview`). Limites: SMS 480, WhatsApp 1024, e-mail 5000 caracteres. Regra com jobs não pode ser excluída (409 → desativar).
- **Elegibilidade:** atraso **exatamente** igual ao da regra; devedor `ativo` ou `comunicado`; contato para o canal; no máximo uma comunicação bem-sucedida por canal por dia (RN03).
- **Disparo:** Celery Beat a cada 5 min, seg–sex, 8h–19h55 (Brasília), **sem disparar em feriados** (RN05: nacionais, facultativos opcionais e `FERIADOS_EXTRAS`, em `app/core/feriados.py`). Reenvios: até 4 tentativas, 30 min entre elas (RN07); e-mail/telefone inválido = `bounce`, falha definitiva (RN08). `POST /regras/{id}/executar` dispara manualmente (regra ativa, dia entre hoje−7 e hoje; 409 se o job do dia já existe). Job fica `executando` enquanto houver reenvio pendente; termina `concluido` ou `falhou`.
- **Status do devedor:** `ativo`, `comunicado`, `negociando`, `quitado`, `inativo`. Comunicação: `pendente`, `enviado`, `entregue` (reservado a webhooks futuros), `falha`, `bounce`.
- **Lote:** processamento assíncrono com polling em `GET /lotes/{id}`. Todo erro rejeita a linha (não há "aviso"); uma linha pode ter vários erros; `numero_linha` conta o cabeçalho como 1; lote `erro` = falha estrutural (motivo em `campo` `cabecalho`/`arquivo`). Reimportar CPF/CNPJ existente **atualiza** o devedor (`total_atualizados`); quitado é rejeitado. `GET /lotes/` não devolve total.
- **Dashboard (RF08):** taxa de entrega = sucesso ÷ comunicações geradas no período; conversão = devedores alcançados hoje quitados; meta 95% (`meta_taxa_entrega`). Taxas podem vir `null`. Não há valores em R$ agregados (o valor da dívida é criptografado). A `timeline` é por dia, sem quebra por canal.
- **Usuários:** não há convite por e-mail nem "último acesso"; gestor não altera perfil (403); ninguém altera o próprio perfil, desativa/exclui a si mesmo ou redefine a própria senha por `/usuarios` (400 — usar `PUT /auth/senha`); desativar/redefinir senha encerram as sessões do alvo; usuário com lotes/regras não é excluído (409).
- O valor da dívida vem descriptografado no `DevedorResponse` como **texto** (`"1500.00"`). CPF/CNPJ é dado pessoal (LGPD): não registre em logs do front nem exporte em arquivo solto.

## Front-end (concluído)
React 19 + Vite 8 + TypeScript + Tailwind v4 + Recharts, porta 8443, Node.js 22 LTS. Rodar: `cd front-end; npm install; npm run dev`. Validar: `npm run verificar` (= o que o CI roda). Detalhes em `front-end/README.md`; roteiro de teste manual em `front-end/ROTEIRO_TESTES.md`.

### Decisões de arquitetura
- **Chamadas direto em `http://localhost:8000`** (`VITE_API_URL`), sem proxy do Vite: o cookie de refresh tem `path=/auth`, e um proxy com prefixo (`/api/auth/refresh`) faria o navegador não enviá-lo. Sempre `localhost`, nunca misturar com `127.0.0.1`. **No deploy vale o mesmo cuidado**: o `/auth` da API precisa ficar acessível no caminho `/auth` (sem prefixo).
- Todo acesso à API passa por `apiFetch` (`src/lib/api.ts`); sessão em `useAuth()` (`src/auth/AuthContext.tsx`); páginas e ações × perfis em `src/auth/permissoes.ts` (`PERFIS_POR_PAGINA`, `PERFIS_POR_ACAO`; use `pode([...])` para esconder ações restritas).
- `fetch` nativo (sem axios); tipos da API escritos à mão em `src/lib/tipos.ts`, conferidos no `/openapi.json`.
- Navegação por `useState` em `App.tsx` (sem `react-router`); `App.tsx` guarda o lote/job aberto (`abrirRelatorio(id)`, `abrirJob(id)`) e desmonta a área logada no logout.
- Identidade visual preto/branco/slate; não há Figma atualizado (o layout pode evoluir mantendo a identidade).

### Mapa do código (`front-end/src`)
- `lib/api.ts`: `apiFetch<T>()` (`credentials: "include"`, um refresh compartilhado em 401, `ApiError` com `status` — 0 = API inacessível; aproveita os 422 com prefixo `"Value error, "` em português), `apiBaixarArquivo(path, nome)` (download autenticado via blob; o nome vem do front porque o CORS não expõe `Content-Disposition`), `consultarSaude()` (lê `/health` mesmo com 503). Upload: `apiFetch(path, { method: "POST", body: formData })`.
- `hooks/`: `useApi<T>(path, { intervaloMs, pararQuando })` (polling sem "piscar"; ao trocar de path, `dados` ainda é o da consulta anterior — compare o id), `useSaude` (`saude` undefined = verificando, null = API sem resposta), `useDebounce`, `useFecharComEsc`.
- `lib/`: `formatos.ts` (números, `percentual`, datas de Brasília sem `new Date` para `YYYY-MM-DD`, `moeda`, `documento`/`documentoMascarado`, `telefone`, `hojeISO`, `somarDias`, `horario`, `corAtraso`, rótulos/cores de status e canal), `lotes.ts` (limites 20 MB/50.000 registros, `validarArquivo`, planilha modelo), `regua.ts` (limites por canal, janela, `validarRegra`, `trechosDoTemplate`), `janela.ts` (`estadoJanela()`; **não conhece feriados**, a tela avisa), `jobs.ts` (`jobEmAndamento`), `usuarios.ts` (validações, `gerarSenha`, `DESCRICAO_PERFIL`, `NOME_ACAO`/`NOME_ENTIDADE` — ao criar uma ação de auditoria no back, acrescente aqui).
- `components/`: `ui.tsx` (`Badge`, `Painel`, `AvisoErro`, `Spinner`, `Modal`, `CampoForm` com `grupo`, `IconeDownload`, classes `BOTAO_*`), `estilos.ts` (`inputClasse`), `DetalheDevedor`, `DetalheJob`, `EditorRegra` (PATCH só com campos alterados; `TemplateDestacado`), `ModaisUsuario`, `MinhaConta`, `CampoSenha`, `Sidebar`.
- `pages/`: `Login`, `Dashboard`, `ImportarLote`, `RelatorioValidacao`, `Devedores`, `ReguaCobranca`, `Monitoramento`, `Usuarios`, `Auditoria`.
- Testes: ESLint 10 (flat config), Vitest 5 + Testing Library (jsdom), 71 testes, cobertura v8 com **mínimo de 80%** em `src/lib`, `src/hooks`, `src/auth` (hoje ~91%).

### Desvios do protótipo/RFC já combinados (cada um por falta de endpoint ou por LGPD)
- Dashboard: painel "Alertas" virou "Distribuição por canal" + conversão.
- Devedores: sem filtro por canal (a API não filtra), sem "último contato" e sem "Exportar CSV" (LGPD); a coluna "Contatos" mostra os canais possíveis. **Atenção: o RF05 do RFC pede filtro por canal** (ver Pendências).
- Régua: cards sem métricas por regra. Monitoramento: o "console de logs" fictício virou saúde dos serviços + janela de disparo + jobs.
- Login: "Esqueceu a senha?" virou "Fale com o administrador".

### Armadilhas conhecidas
- Arquivos `.tsx` de componente só exportam componentes (react-refresh); helpers vão para `lib/`/`hooks/`. Exceção: `useAuth` junto do `AuthProvider`.
- Ao mockar `apiFetch` nos testes, crie `vi.fn()` novo no `beforeEach` (o `mockReset` do Vitest 5 gera "unhandled rejection").
- Em JSDoc, `***/` (ex.: CNPJ mascarado) fecha o comentário e quebra o build.
- Dentro de `<label>` não coloque grupos de botões (use `CampoForm grupo`).
- No Windows, `curl ... | python -m json.tool` mostra acentos "corrompidos" (cp1252) — não é bug da API. No Git Bash, mande JSON com acento via arquivo (`--data-binary @arquivo.json`).
- Massa de demonstração: CSV `cpf_cnpj,nome,email,valor_divida,data_vencimento,telefone` (CPFs válidos, data `DD/MM/AAAA`, valor com ponto) + regra ativa + `POST /regras/{id}/executar`.
- Build: aviso de chunk > 500 kB (~704 kB, Recharts) é conhecido; code-splitting ainda não feito.
- `npm audit`: moderates só em dependências de dev (ESLint/`minimatch`); `npm audit --omit=dev` = 0.

## Pendências do projeto (próxima fase)
Ordem sugerida:
1. **Confirmar o Ruleset da `main`** com o check `Front-end (lint, tipos, testes e build)` (o job já rodou no GitHub).
2. **Teste real do SendGrid/Twilio** (`app.testar_provedores`) e autenticação de domínio do remetente.
3. **RF05 — filtro de devedores por canal**: implementar no back (`GET /devedores/?canal=` = tem contato para o canal) e no front, ou registrar o desvio no RFC.
4. **Deploy na AWS** (RDS PostgreSQL, EC2) e o passo de deploy do CI. Antes, falta:
   - **Containerizar o front** (RNF09: hoje só o back está no Compose) — ex.: Dockerfile multi-stage (build do Vite + Nginx servindo `dist/`), com `VITE_API_URL` definido no build.
   - Configuração de produção: HTTPS, `ENVIRONMENT=production`, `COOKIE_SECURE=true`, `CORS_ORIGINS` com o domínio real, `COOKIE_SAMESITE` adequado (front e API no mesmo site evita `none`), segredos fora do repositório, senha do admin trocada.
5. **Evidência dos RNF01/RNF02** (100 usuários simultâneos, P95 < 300 ms): não há teste de carga no repositório (ex.: k6 ou Locust + métricas do Prometheus/Grafana).
6. **Webhooks de status de entrega** (`entregue`) e **templates aprovados do WhatsApp** (produção).
7. Opcionais: code-splitting do front (`React.lazy` por página), monitoramento (`docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d` — Prometheus :9090, Grafana :3000), limpeza de branches remotas antigas.

## Documentação
- `README.md`: visão geral, como rodar, status do projeto.
- `back-end/DOC.md`: execução, testes, CI/CD, métricas, regras e limitações conhecidas.
- `front-end/README.md` e `front-end/ROTEIRO_TESTES.md`: front e roteiro de teste manual.
- `docs/RFC.md`: requisitos (RF/RN/RNF), v1.1 — o texto da proposta; a stack citada nele (ex.: "React 18") é a da época e não foi reescrita.
- `docs/RFC-v1.0.md`: proposta original; a v1.1 remete a ela para os diagramas de casos de uso, mockups e C4.
