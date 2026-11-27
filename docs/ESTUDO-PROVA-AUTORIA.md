# Guia de estudo: prova de autoria

> Material pessoal de estudo da Mariele para a apresentação oral. Explica **como tudo funciona e por quê**, do clique no navegador até o banco na AWS, e como o código sai do VS Code e chega em produção.
>
> **Como usar:** leia na ordem. A seção 6 (AWS) e a seção 7 (deploy) foram o ponto fraco da conversa anterior com o professor: leia duas vezes e tente explicar em voz alta, sem olhar, usando os diagramas. A seção 11 tem as perguntas prováveis com respostas curtas.

---

## Sumário

1. [O projeto em 1 minuto](#1-o-projeto-em-1-minuto)
2. [Arquitetura geral](#2-arquitetura-geral)
3. [Back-end](#3-back-end)
4. [Front-end](#4-front-end)
5. [Ambiente local (desenvolvimento)](#5-ambiente-local-desenvolvimento)
6. [Infraestrutura na AWS](#6-infraestrutura-na-aws) ⭐
7. [CI/CD e deploy](#7-cicd-e-deploy) ⭐
8. [Qualidade, testes e desempenho](#8-qualidade-testes-e-desempenho)
9. [Decisões e desvios do RFC](#9-decisões-e-desvios-do-rfc)
10. [Limitações e trabalho futuro](#10-limitações-e-trabalho-futuro)
11. [Perguntas prováveis e respostas](#11-perguntas-prováveis-e-respostas) ⭐
12. [Glossário](#12-glossário)
13. [Sugestão de roteiro da apresentação](#13-sugestão-de-roteiro-da-apresentação)

---

## 1. O projeto em 1 minuto

**Problema.** Empresas de cobrança (como a parceira, Consulth) recebem planilhas com milhares de devedores e precisam contatar cada um no momento certo, pelo canal certo, sem mandar mensagens repetidas nem fora do horário permitido. Fazer isso à mão é lento e sujeito a erro.

**Solução.** Uma plataforma web que:

1. **Importa lotes** de devedores (CSV, XLSX ou XLS), valida linha por linha (CPF/CNPJ, e-mail, valor, data) e mostra um relatório de erros.
2. Aplica uma **régua de cobrança**: regras do tipo "no **5º dia** de atraso, às **9h**, mande **e-mail** com este texto".
3. **Dispara automaticamente** as mensagens (e-mail pelo SendGrid; SMS e WhatsApp pela Twilio), com **reenvio** em caso de falha temporária, só em **dias úteis** e no **horário comercial**.
4. Mostra **dashboard**, monitoramento dos disparos, gestão de usuários com **perfis** e **log de auditoria** (LGPD).

**Frase de efeito para abrir:** "É um sistema que pega uma planilha de devedores e, sozinho, decide quem precisa ser contatado hoje, por qual canal e com qual mensagem, respeitando horário, feriados e LGPD; e que está publicado na AWS com deploy automatizado."

---

## 2. Arquitetura geral

```
                        ┌──────────────────────────── EC2 (servidor na AWS) ────────────────────────────┐
                        │                                                                                │
 Navegador ── HTTPS ──► │  web (Caddy) ──┬──► arquivos do front-end (React já compilado)                 │
 (porta 443)            │                └──► /auth, /lotes, /devedores... ──► api (FastAPI)             │
                        │                                                         │      │              │
                        │                                     publica tarefas ───┘      │              │
                        │                                          ▼                     │              │
                        │   beat (relógio) ──► rabbitmq (fila) ──► worker (Celery) ─────┤              │
                        │                                                                │              │
                        │   redis (sessões revogadas, travas, contador de login)         │              │
                        └────────────────────────────────────────────────────────────────┼──────────────┘
                                                                                         │ TLS, porta 5432
                                                                          RDS PostgreSQL (rede privada)
```

**Os 7 componentes e o papel de cada um:**

| Componente | Tecnologia | O que faz | Analogia |
|---|---|---|---|
| `web` | **Caddy** | Porta de entrada: HTTPS, entrega o front e repassa as chamadas da API | Recepção do prédio |
| `api` | **FastAPI** (Python) | Recebe as requisições, valida, aplica regras de negócio, lê/grava no banco | Atendente |
| `worker` | **Celery** | Executa tarefas demoradas em segundo plano (processar planilha, disparar mensagens) | Equipe dos bastidores |
| `beat` | **Celery Beat** | Relógio: a cada 5 min (dias úteis, 8h–19h55) cria a tarefa "ciclo de disparo" | Despertador |
| `rabbitmq` | **RabbitMQ** | Fila de mensagens entre a API/beat e o worker | Caixa de pedidos |
| `redis` | **Redis** | Memória rápida: tokens revogados, travas, contador de tentativas de login, resultados do Celery | Post-it |
| Banco | **PostgreSQL 15** (RDS) | Dados permanentes: usuários, devedores, regras, jobs, comunicações, auditoria | Arquivo/cofre |

**Por que separar API e worker?** Processar 50.000 linhas leva cerca de 2 minutos. Se a API fizesse isso dentro da requisição, o navegador ficaria esperando e a conexão cairia. Então a API **só salva o arquivo e põe um pedido na fila** (responde na hora), e o worker processa em paralelo. O front acompanha o progresso consultando o lote a cada poucos segundos (*polling*).

---

## 3. Back-end

### 3.1 Tecnologias e por quê

| Tecnologia | Por quê |
|---|---|
| **Python 3.14 + FastAPI** | Rápido de escrever, validação automática com Pydantic, documentação OpenAPI gerada sozinha (`/docs`) |
| **SQLAlchemy 2.1** (ORM) | Mapeia tabelas em classes Python; evita SQL injection (consultas parametrizadas) |
| **Alembic** | Migrações do banco versionadas (`0001` a `0005`); o esquema evolui junto com o código |
| **PostgreSQL 15** | Banco relacional robusto; transações, travas de linha (`FOR UPDATE SKIP LOCKED`), restrições únicas |
| **Celery + RabbitMQ** | Tarefas assíncronas confiáveis e agendamento recorrente (Beat) |
| **Redis** | Armazenamento em memória com expiração automática (TTL), ideal para tokens revogados e travas |
| **pandas** | Leitura de CSV/XLSX/XLS |

### 3.2 Organização do código (`back-end/app/`)

| Pasta | Responsabilidade |
|---|---|
| `api/` | **Rotas** (controllers): `auth`, `lotes`, `devedores`, `usuarios`, `auditoria`, `regras`, `jobs`, `dashboard`, `metricas`. `deps.py` tem `get_current_user` e `role_required` (RBAC) |
| `schemas/` | Modelos **Pydantic**: formato de entrada e saída de cada rota (validação automática → erro 422) |
| `models/domain.py` | Modelos do **banco** (tabelas) |
| `services/` | **Regras de negócio**: `regua.py` (quem é elegível), `disparo.py` (criar jobs, enviar, reenviar), `dashboard.py` |
| `worker/` | **Tarefas do Celery**: `tasks.py` (processar lote), `disparo_tasks.py` (ciclo de disparo), `validadores.py` (CPF/CNPJ, e-mail, telefone, valor, data) |
| `clients/` | **Provedores de envio**: `sendgrid.py`, `twilio.py`, `simulado.py`; `obter_cliente(canal)` escolhe qual usar |
| `core/` | Infra transversal: `config.py` (variáveis de ambiente), `security.py` (bcrypt, JWT, cookies), `crypto.py` (Fernet), `database.py`, `celery_app.py`, `feriados.py`, `janela.py`, `rate_limit.py`, `redis_client.py`, `auditoria.py`, `metricas.py` |

**Arquitetura em camadas:** rota (recebe HTTP) → schema (valida) → service (regra de negócio) → model (banco). Isso separa responsabilidades e facilita testar cada parte.

### 3.3 Banco de dados (8 tabelas)

| Tabela | Guarda |
|---|---|
| `usuarios` | nome, e-mail, hash da senha (bcrypt), `cargo` (no JSON vira `perfil`), ativo |
| `lotes` | arquivo importado, status (`pendente → processando → concluido` ou `erro`), totais (válidos, atualizados, rejeitados) |
| `erros_lote` | cada erro de cada linha (número da linha, campo, regra, valor) |
| `devedores` | CPF/CNPJ, nome, e-mail, telefone, **valor da dívida criptografado** (`valor_divida_enc`), vencimento, status |
| `regras_cobranca` | canal, dias de atraso, horário, template, ativa |
| `jobs` | uma execução de uma regra num dia (restrição única `regra_id + dia_referencia`: nunca dois jobs da mesma regra no mesmo dia) |
| `comunicacoes` | cada mensagem: devedor, canal, status (`pendente/enviado/entregue/falha/bounce`), tentativas, próxima tentativa, código de erro |
| `logs_auditoria` | quem fez o quê, quando, de qual IP (RF11) |

Há **índices** nas consultas frequentes (ex.: `status + data_vencimento` dos devedores, usado pela régua).

### 3.4 Fluxo 1: importação de lote (RF01–RF03)

```
Front                    API                          RabbitMQ          Worker                         Banco
  │ POST /lotes/upload ──►│ valida extensão e tamanho    │                 │                              │
  │   (multipart)         │ (até 20 MB; 422/413)         │                 │                              │
  │                       │ salva o arquivo no volume    │                 │                              │
  │                       │ cria Lote "pendente" ───────────────────────────────────────────────────────► │
  │                       │ processar_lote_task.delay ──►│ ──────────────► │                              │
  │ ◄── 200 {lote_id} ────│                              │                 │ lê com pandas                │
  │                                                                        │ normaliza colunas            │
  │ GET /lotes/{id} (polling a cada poucos s)                              │ valida cada linha            │
  │ ◄── progresso ──────── lê do banco ◄──────────────────────────────────  │ grava em blocos de 1.000 ──► │
  │                                                                        │ (atualiza o progresso)       │
  │ GET /lotes/{id}/erros(/csv) → relatório                                │ status "concluido"           │
```

- Cada linha é validada: CPF/CNPJ com **dígito verificador**, e-mail, valor, data `DD/MM/AAAA`, telefone. Qualquer erro **rejeita a linha** (RN04); uma linha pode ter vários erros.
- CPF/CNPJ que já existe **atualiza** o devedor (não duplica); devedor quitado é rejeitado.
- Erro estrutural (cabeçalho faltando, arquivo corrompido) → lote inteiro em `erro`.
- A API e o worker compartilham o arquivo por um **volume Docker** (`uploads_data`).

### 3.5 Fluxo 2: régua e disparo (RF04, RF06, RF07)

**Regra:** canal + dias de atraso + horário "a partir de" (08:00–20:00) + template com variáveis (`{nome}`, `{primeiro_nome}`, `{valor}`, `{data_vencimento}`, `{dias_atraso}`). Nasce **inativa**; só pode haver **uma regra ativa por (canal, dias de atraso)**.

**Quem é elegível hoje** (`services/regua.py`, `consulta_elegiveis`):
1. atraso **exatamente** igual ao da regra (`data_vencimento = hoje − dias_atraso`);
2. status `ativo` ou `comunicado`;
3. tem o contato do canal (e-mail para e-mail; telefone para SMS/WhatsApp);
4. **RN03:** ainda não recebeu comunicação **bem-sucedida** desse canal hoje.

**O ciclo de disparo** (a cada 5 minutos):

```
Beat (*/5 min, seg–sex, 8h–19h55, horário de Brasília)
  └─► fila ─► worker executa ciclo_de_disparo()
                 1. pega uma TRAVA no Redis (evita dois ciclos ao mesmo tempo)
                 2. agendar_jobs(): para cada regra ativa cujo horário já chegou,
                    cria o JOB do dia + uma COMUNICAÇÃO "pendente" por devedor elegível
                    (idempotente: se o job do dia já existe, não cria de novo)
                 3. processar_fila(): pega as comunicações vencidas, em blocos de 200,
                    trava cada linha com FOR UPDATE SKIP LOCKED e envia pelo cliente do canal
                       ├─ enviado  → status "enviado"; devedor passa a "comunicado"
                       ├─ bounce   → definitivo na hora (e-mail/telefone inválido, RN08)
                       └─ falha    → reenvio em 30 min, até 4 tentativas (RN07);
                                     se cair fora da janela, vai para a próxima janela válida
                 4. atualizar_jobs(): recalcula contadores; job sem pendências → "concluido"
                 5. libera a trava
```

- **Feriados e fim de semana (RN05):** o beat só roda em dias úteis e `dentro_da_janela()` também confere feriados nacionais (`core/feriados.py`).
- **Disparo manual:** `POST /regras/{id}/executar` cria o job (o envio acontece no próximo ciclo, respeitando a janela).
- **Por que é seguro contra envio duplicado?**
  - trava no Redis para o ciclo;
  - restrição única no banco para o job do dia;
  - `FOR UPDATE SKIP LOCKED` em cada comunicação (dois workers nunca pegam a mesma);
  - `commit` logo após cada envio (se o worker cair, não reenvia o que já foi);
  - Celery com `task_acks_late` (a tarefa só sai da fila depois de terminar).

### 3.6 Envio real × simulado (padrão Strategy)

Todos os provedores implementam a mesma interface `ClienteCanal.enviar(destino, mensagem, assunto)` e devolvem um `ResultadoEnvio` (enviado / temporária / bounce). `obter_cliente(canal)` escolhe a implementação:

- `ENVIO_SIMULADO=true` (padrão, inclusive em produção): cliente **simulado** (e-mail começando com `bounce` → bounce; `falha...` → falha temporária; o resto → enviado). Permite testar tudo sem custo e sem mandar mensagem para pessoas reais.
- `ENVIO_SIMULADO=false` + `ENVIO_REAL_CANAIS=email`: só o e-mail sai de verdade pelo **SendGrid** (validado em produção em 24/11/2026); SMS/WhatsApp continuam simulados.
- **Por que não há botão na tela para ligar o envio real?** Um clique errado dispararia cobrança real para a base inteira. Fica como configuração do servidor (`.env`), de propósito.

### 3.7 Autenticação e segurança

| Item | Como funciona |
|---|---|
| **Senha** | Guardada como hash **bcrypt** (custo 12, com *salt*); nunca em texto. Regras: 8–128 caracteres, letra e número |
| **Login** | `POST /auth/login` → o servidor gera dois **JWT** (assinados com HS256 e `JWT_SECRET`) e grava em **cookies httpOnly** |
| **Access token** | 15 minutos, enviado em toda requisição |
| **Refresh token** | 7 dias, cookie com `path=/auth` (o navegador só o manda para `/auth/...`) |
| **httpOnly** | O JavaScript **não consegue ler** o token → protege contra roubo por XSS |
| **Secure + SameSite=Lax** | Cookie só vai por HTTPS e não é enviado em requisições de outros sites (protege contra CSRF) |
| **Renovação** | Em 401, o front chama `POST /auth/refresh` uma vez; o refresh é **rotacionado** (o antigo é revogado) |
| **Logout/revogação** | Cada token tem um `jti` (id único). No logout, o `jti` vai para o Redis como "revogado" até expirar. Desativar usuário ou redefinir senha **encerra todas as sessões** dele |
| **Força bruta** | 5 falhas de login (por IP + e-mail) → bloqueio temporário (HTTP 429), contado no Redis |
| **RBAC (RN06)** | `role_required([...])` em cada rota. Operador: importa e consulta. Gestor: régua, marcar quitado, gerencia operadores. Administrador: tudo, inclusive auditoria e excluir devedor |
| **Auditoria (RF11)** | Login, criação/edição de usuários, regras, exclusões etc. ficam em `logs_auditoria` com o **IP real** (o Caddy repassa o `X-Forwarded-For`) |

### 3.8 LGPD e criptografia

- **Criptografia em repouso (RNF05), em duas camadas:**
  1. a AWS criptografa o disco da EC2 e o banco RDS;
  2. a aplicação criptografa o **valor da dívida** com **Fernet** (AES + HMAC, biblioteca `cryptography`) antes de gravar (`valor_divida_enc`). Sem a `ENCRYPTION_KEY`, o valor é ilegível mesmo para quem acessar o banco.
  - Consequência: o dashboard não mostra totais em R$ (o banco não consegue somar dado criptografado).
- **Em trânsito:** HTTPS até o navegador; TLS (`sslmode=require`) até o RDS. A API **se recusa a subir** em produção sem isso.
- **Direito de exclusão (RF12, LGPD art. 18):** `DELETE /devedores/{id}` (só administrador) apaga o devedor e as comunicações.
- Sem exportação de CSV de devedores (arquivo solto com CPF seria risco) e nada de CPF ou mensagem nos logs.

### 3.9 Métricas (RNF08)

Um *middleware* mede cada requisição (método, rota-modelo, status, tempo) e expõe em `/metrics` no formato **Prometheus**. Localmente há Prometheus + Grafana (`docker-compose.monitoring.yml`). Em produção, o `/metrics` **não é exposto** pelo Caddy e o Grafana não roda (a EC2 tem só 2 GB de RAM).

---

## 4. Front-end

| Item | Escolha |
|---|---|
| Base | **React 19 + TypeScript + Vite 8** |
| Estilo | **Tailwind CSS v4**, fonte IBM Plex Sans; preto/branco/cinza, **cor só para estado** (verde = sucesso, âmbar = atenção, vermelho = falha, azul = em andamento, violeta = comunicado) |
| Gráficos | **Recharts** |
| Chamadas à API | `fetch` nativo via **`apiFetch`** (`src/lib/api.ts`), com `credentials: "include"` (envia os cookies) e um refresh automático em 401 |
| Sessão | `AuthContext` (`useAuth()`): sabe quem está logado (`GET /auth/me`) |
| Permissões | `src/auth/permissoes.ts`: quais páginas e ações cada perfil vê (o back-end **também** confere; o front só esconde) |
| Navegação | Estado em `App.tsx` (sem `react-router`) |
| Atualização automática | `useApi` com *polling*: Dashboard a cada 60 s, Monitoramento a cada 15 s, lote em processamento a cada poucos segundos |

**Telas:** Login, Dashboard, Importar lote, Relatório de validação, Devedores (filtros por status, atraso, canal e busca), Régua de cobrança (linha do tempo D+N, editor com pré-visualização), Monitoramento (saúde dos serviços, janela de disparo, jobs), Usuários, Auditoria.

**Ponto importante (pergunta provável):** por que o front chama `/auth/login` e não `/api/auth/login`? Porque o cookie de refresh tem `path=/auth`. Se houvesse um prefixo `/api`, o navegador não enviaria o cookie para `/api/auth/refresh` e a renovação de sessão quebraria. Por isso o Caddy repassa as rotas **sem prefixo**.

---

## 5. Ambiente local (desenvolvimento)

- `back-end/docker-compose.yml` sobe `db` (PostgreSQL em contêiner), `redis`, `rabbitmq`, `api`, `worker`, `beat`. Comando: `docker compose up -d --build` na pasta `back-end`.
- Front: `cd front-end; npm install; npm run dev` (porta 8443), chamando a API em `http://localhost:8000`.
- **Diferença para produção:** localmente o banco é um contêiner; em produção é o **RDS**. O front local é servido pelo Vite; em produção é compilado e servido pelo Caddy.

---

## 6. Infraestrutura na AWS

> ⭐ Esta é a seção que o professor perguntou. Entenda **o que é cada peça, como está configurada e por quê**.

### 6.1 Visão em uma frase

"Uso **uma máquina virtual EC2** na região de **Ohio**, que roda os contêineres da aplicação com Docker Compose, e um **banco PostgreSQL gerenciado (RDS)** numa rede privada que só aceita conexões vindas da EC2. O domínio `cobranca-tcc.duckdns.org` aponta para o **IP fixo (Elastic IP)** da EC2, e o **Caddy** emite o certificado HTTPS sozinho."

### 6.2 Diagrama da AWS

```
                     Internet
                        │
        DNS: cobranca-tcc.duckdns.org ──► Elastic IP (IP público fixo)
                        │
 ┌──────────────────────┼─────────── AWS · região us-east-2 (Ohio) · VPC da conta ──────────────────────┐
 │                      ▼                                                                               │
 │   ┌─ Security group "cobranca-ec2" ──────────────────┐     ┌─ Security group "cobranca-rds" ───────┐   │
 │   │ entrada: 80, 443 (qualquer origem), 22 (SSH)     │     │ entrada: SÓ 5432, SÓ vindo do         │   │
 │   │                                                  │     │ security group "cobranca-ec2"         │   │
 │   │  EC2 "cobranca" (t3.small, Ubuntu 24.04)         │     │                                       │   │
 │   │  disco 20 GB gp3 criptografado + swap 2 GB       │────►│  RDS "cobranca-db"                    │   │
 │   │  Docker Compose: web, api, worker, beat,         │ TLS │  PostgreSQL 15.19, db.t4g.micro       │   │
 │   │                  redis, rabbitmq                 │5432 │  20 GB, criptografado, sem acesso     │   │
 │   └──────────────────────────────────────────────────┘     │  público, backup diário (1 dia)       │   │
 │                                                            └───────────────────────────────────────┘   │
 └────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Cada recurso, explicado

#### EC2 (Elastic Compute Cloud): o servidor

- **O que é:** uma máquina virtual alugada por hora. É o "computador" onde a aplicação roda.
- **Configuração:**
  - nome `cobranca`; sistema **Ubuntu Server 24.04 LTS** (x86);
  - tipo **`t3.small`**: 2 vCPUs, 2 GB de RAM;
  - disco **EBS de 20 GB, tipo gp3, criptografado**;
  - **swap de 2 GB** (memória extra em disco, criada pelo `deploy/preparar-ec2.sh`), porque 2 GB de RAM é apertado para 6 contêineres;
  - Docker Engine + plugin do Compose, instalados pelo mesmo script.
- **Por que `t3.small` e não `t3.micro`?** A micro tem 1 GB de RAM: não cabem RabbitMQ, Celery e a API juntos.
- **Instância "burstable" (família T) com crédito "Padrão":** a CPU tem uma linha de base (20% por vCPU na t3.small) e acumula **créditos** quando está ociosa, que gasta em picos. No modo **Padrão**, quando os créditos acabam, ela fica mais lenta **mas não cobra extra** (no modo Ilimitado, cobraria). Escolhido para não estourar o orçamento.
- **O que roda nela:** só Docker. **Não há código-fonte no servidor**: só o `docker-compose.yml` e o `.env` na pasta `~/cobranca`. As imagens vêm prontas do GitHub (ver seção 7).

#### Elastic IP: o endereço fixo

- **O que é:** um IP público estático da AWS, associado à EC2.
- **Por quê:** sem ele, a EC2 ganha um IP novo a cada vez que é parada e iniciada, e o domínio deixaria de funcionar.
- Atenção: IP público é cobrado (e um Elastic IP sem uso também); no fim do TCC, **liberar o Elastic IP**.

#### Security groups: o firewall

- **O que é:** um firewall virtual ligado a cada recurso, que diz **quem pode entrar em qual porta**. É *stateful*: se a entrada é permitida, a resposta sai automaticamente.
- **`cobranca-ec2`** (da EC2):
  - **80 (HTTP)**: usado pelo Let's Encrypt para validar o domínio e para redirecionar para HTTPS;
  - **443 (HTTPS)**: o site;
  - **22 (SSH)**: administração, **só com chave** (sem senha).
- **`cobranca-rds`** (do banco): só a **porta 5432**, e a origem não é um IP, é **o próprio security group da EC2**. Ou seja: **só a EC2 fala com o banco**. Nem eu, do meu PC, consigo acessar o banco diretamente.
- As portas da API (8000), do Redis (6379) e do RabbitMQ (5672) **não são publicadas**: existem só na rede interna do Docker. Da internet, só o Caddy é alcançável.

#### RDS (Relational Database Service): o banco gerenciado

- **O que é:** PostgreSQL em que a AWS cuida de instalação, atualizações de segurança, backup e criptografia.
- **Configuração:**
  - nome `cobranca-db`, **PostgreSQL 15.19** (mesma versão maior do CI e do ambiente local);
  - classe **`db.t4g.micro`** (processador ARM Graviton, 1 GB de RAM; está no nível gratuito);
  - **Single-AZ** (uma zona de disponibilidade só, mais barato);
  - 20 GB gp3, **sem autoscaling** de armazenamento (para não crescer sem controle);
  - **sem acesso público**; **criptografado**;
  - banco `cobranca_db`, usuário `cobranca_app`;
  - grupo de parâmetros `default.postgres15`, que **exige TLS**; a aplicação conecta com `sslmode=require`;
  - **backup automático diário com retenção de 1 dia** (o máximo que o plano gratuito permite). Antes de algo arriscado (migração nova, véspera da banca), tiro um **snapshot manual**.
- **Por que o banco não é um contêiner na EC2, como Redis e RabbitMQ?** O banco guarda o que não pode ser perdido (devedores, regras, histórico, auditoria). No RDS ele tem backup, criptografia e manutenção gerenciados. Redis e RabbitMQ guardam dados **transitórios** (filas, tokens que expiram), e as versões gerenciadas (ElastiCache, Amazon MQ) multiplicariam o custo sem benefício proporcional para o volume do projeto.

#### Região `us-east-2` (Ohio)

- **Por que não São Paulo (`sa-east-1`)?** São Paulo é uma das regiões mais caras da AWS. Com os créditos limitados (~US$ 140, até 16/05/2027), Ohio mantém o ambiente no ar por mais tempo.
- **Custos dessa escolha:** latência maior (~120–150 ms por requisição, estimado) e dados fora do Brasil (transferência internacional, **LGPD art. 33**). Aceitável porque **o TCC usa apenas dados fictícios**.
- **Para uso real:** recriar em `sa-east-1`. O código não depende de região.

#### Domínio (DuckDNS) e HTTPS (Let's Encrypt)

- **DuckDNS** é um serviço gratuito de DNS: `cobranca-tcc.duckdns.org` → Elastic IP. O campo IPv6 ficou **vazio**, porque a EC2 não tem IPv6 e o Let's Encrypt tentaria validar por ele e falharia.
- **Por que precisa de domínio?** Certificado HTTPS é emitido para um **nome**, não para um IP.
- **Let's Encrypt** é uma autoridade certificadora gratuita. O **Caddy** pede o certificado sozinho na primeira subida, prova que controla o domínio (desafio pela porta 80/443), instala e **renova automaticamente** antes de vencer (o certificado vale 90 dias). Os certificados ficam no volume `caddy_data` (não apagar: há limite de emissões).

#### Custos e conta

- Conta no plano gratuito, login com **MFA**. Créditos ~US$ 140 até 16/05/2027.
- **Orçamento** `tcc-cobranca-mensal` de **US$ 16/mês**, alertas por e-mail em 80% (gasto real) e 100% (previsão), com "crédito excluído" (senão o gasto aparece sempre como US$ 0).
- No fim do TCC: apagar EC2 e RDS e **liberar o Elastic IP**.

### 6.4 O caminho de uma requisição, passo a passo

Exemplo: o usuário abre a lista de devedores.

1. O navegador pergunta ao **DNS** qual o IP de `cobranca-tcc.duckdns.org` → recebe o **Elastic IP**.
2. Abre uma conexão **HTTPS na porta 443**. O **security group** `cobranca-ec2` permite.
3. Chega no contêiner **`web` (Caddy)**, que apresenta o certificado Let's Encrypt (cadeado no navegador).
4. O caminho é `/devedores/` → bate na lista `@api` do Caddyfile → o Caddy repassa para **`api:8000`** pela rede interna do Docker, incluindo o IP real do usuário no cabeçalho `X-Forwarded-For`.
5. A **API (FastAPI)** lê o cookie com o access token, confere a assinatura do JWT e se o `jti` não está revogado no **Redis**, confere o perfil (RBAC).
6. Consulta o **RDS** pela porta 5432 com **TLS** (o security group `cobranca-rds` só aceita porque vem da EC2).
7. Descriptografa o valor da dívida (Fernet), monta o JSON e devolve: API → Caddy → navegador.

Se o caminho **não** for de API (ex.: `/`, `/assets/index-abc.js`), o Caddy entrega os **arquivos estáticos do React** que estão dentro da própria imagem `web`.

### 6.5 Configuração no servidor (`~/cobranca/` na EC2)

```
~/cobranca/
├── docker-compose.yml   ← copiado pelo pipeline a cada deploy (vem de deploy/docker-compose.prod.yml)
└── .env                 ← segredos; criado à mão uma vez, chmod 600, NUNCA vai para o Git
```

O `.env` (modelo em `deploy/.env.example`) contém: `ENVIRONMENT=production`, `DOMINIO`, `DATABASE_URL` (endpoint do RDS com `sslmode=require`), usuário/senha do RabbitMQ, `JWT_SECRET`, `ENCRYPTION_KEY` (Fernet), `CORS_ORIGINS`, `COOKIE_SECURE=true`, dados do admin inicial, parâmetros da régua, `ENVIO_SIMULADO`, `ENVIO_REAL_CANAIS` e chaves do SendGrid/Twilio. Há cópia dos segredos no meu gerenciador de senhas (sem a `ENCRYPTION_KEY`, os valores das dívidas ficariam ilegíveis para sempre).

**Proteções no código:** em produção, a API se recusa a subir se `COOKIE_SECURE` não for `true`, se a conexão do banco não exigir TLS, se faltarem as chaves dos canais com envio real ligado, ou se o admin usar a senha padrão.

**Compose de produção, detalhes que valem citar:**

- `restart: unless-stopped`: se um contêiner cair (ou a EC2 reiniciar), o Docker sobe de novo.
- **healthchecks**: Redis (`ping`), RabbitMQ (`rabbitmq-diagnostics ping`), API (`/health`); `depends_on` com `condition: service_healthy` garante a ordem de subida (worker e beat só sobem depois da API saudável).
- **Só a API roda as migrações** (`alembic upgrade head && uvicorn ... --workers 2`).
- Logs com rotação (10 MB × 3 arquivos) para não lotar o disco.
- RabbitMQ sem painel de gestão e com o *busy-wait* do Erlang desligado (economiza CPU/créditos da t3.small; achado no teste de carga).
- Redis com `appendonly yes`: os tokens revogados sobrevivem a um reinício.

---

## 7. CI/CD e deploy

> ⭐ A outra metade da pergunta do professor. Saiba contar a história "do commit até o site".

### 7.1 Conceitos rápidos

- **CI (integração contínua):** a cada push/PR, testes e verificações rodam automaticamente.
- **CD (entrega contínua):** quando o código aprovado chega na `main`, ele é empacotado e publicado em produção automaticamente (no meu caso, com uma aprovação manual).
- **GitHub Actions:** o serviço de CI/CD do GitHub. O arquivo `.github/workflows/ci.yml` define um **workflow** com **jobs**; cada job roda numa máquina temporária do GitHub (**runner**, Ubuntu) e tem **steps**. `needs:` define dependência entre jobs.
- **Imagem Docker:** pacote com o sistema, as dependências e o código, pronto para rodar. **Contêiner** é a imagem em execução.
- **GHCR (GitHub Container Registry):** "repositório de imagens" do GitHub (`ghcr.io/marielev/cobranca-api` e `cobranca-web`).

### 7.2 Fluxo de branches (git-flow)

```
feature/xxx ──merge --no-ff──► develop ──Pull Request──► main ──► deploy em produção
```

- A `main` é protegida por um **Ruleset** ("Proteção da Main"): só recebe código por **PR**, e só se os **4 checks** passarem: `Testes e SonarCloud`, `Migrações no PostgreSQL`, `Build da imagem Docker`, `Front-end (lint, tipos, testes e build)`. Também exige a branch atualizada com a `main`.
- **Todo merge na `main` dispara um deploy.**

### 7.3 Os 5 jobs do pipeline

```
 push/PR ─► [1] Testes e SonarCloud ─────┐
          ─► [2] Migrações no PostgreSQL ─┤
          ─► [3] Build da imagem Docker ──┼──► [5] Deploy  (só em push na main, ambiente "producao",
          ─► [4] Front-end ───────────────┘                  com aprovação manual)
```

| Job | O que faz | Por quê |
|---|---|---|
| **1. Testes e SonarCloud** | Instala Python 3.14, roda `pytest` com **cobertura mínima de 80%** (falha abaixo). Em PRs e na `main`, envia ao **SonarCloud** e espera o **Quality Gate** (`sonar.qualitygate.wait=true`) | RNF06 e RNF07: código sem teste ou com problema de qualidade não passa |
| **2. Migrações no PostgreSQL** | Sobe um PostgreSQL 15 de verdade, roda `alembic upgrade head`, `alembic check` (modelos e migrações em sincronia) e testa desfazer/refazer a última migração | Garante que a migração não quebra o banco de produção |
| **3. Build da imagem Docker** | Constrói as imagens da API e do front, valida o `Caddyfile` e o `docker-compose.prod.yml` | Garante que o que vai para produção compila e está bem configurado |
| **4. Front-end** | Node 22, `npm ci`, ESLint sem avisos, checagem de tipos (TypeScript), Vitest com **cobertura mínima de 80%**, `npm run build` | Mesmo padrão de qualidade no front |
| **5. Deploy** | Detalhado abaixo | Entrega contínua |

### 7.4 O job de Deploy, passo a passo

Só roda se: é **push na `main`** **e** os 4 jobs passaram (`needs`). Usa o **ambiente `producao`** do GitHub.

1. **Pausa para aprovação manual.** O ambiente `producao` tem *Required reviewers* = eu. O job fica "Aguardando" até eu clicar em **Revisar implantações → Aprovar e implantar**. O ambiente também só aceita a branch `main`.
2. **Login no GHCR** com o `GITHUB_TOKEN` (token temporário que o próprio GitHub gera para o job, com permissão `packages: write`).
3. **Build e push das imagens** `cobranca-api` e `cobranca-web`, cada uma com **duas tags**: o **SHA do commit** (identifica exatamente a versão) e `latest`.
4. **Configura o SSH** com os **segredos do ambiente**:
   - `EC2_HOST` (o domínio), `EC2_USUARIO` (`ubuntu`);
   - `EC2_CHAVE_SSH` (chave privada para entrar na EC2);
   - `EC2_KNOWN_HOSTS` (a "impressão digital" do servidor, com `StrictHostKeyChecking yes`: o runner **se recusa** a conectar se o servidor não for o esperado → protege contra ataque *man-in-the-middle*).
   - Os segredos entram como variáveis de ambiente, nunca escritos direto no script.
5. **Atualiza a EC2:**
   - `scp` do `deploy/docker-compose.prod.yml` para `~/cobranca/docker-compose.yml`;
   - por SSH: `docker compose pull` (baixa as imagens novas do GHCR) e `docker compose up -d --remove-orphans --wait --wait-timeout 300` (recria só os contêineres que mudaram e **espera todos ficarem saudáveis**, até 5 min); depois `docker image prune -f` (apaga imagens antigas para não lotar o disco).
   - Ao subir, a API roda `alembic upgrade head`: **as migrações são aplicadas automaticamente**.
6. **Teste de fumaça:** `curl https://DOMINIO/health` com até 10 tentativas. O `/health` confere Postgres, Redis e RabbitMQ; se passar, confirma de uma vez DNS, HTTPS, Caddy, API, banco e fila.

**Outros cuidados:** na `main`, execuções **não se cancelam** (`concurrency`), para não deixar um deploy pela metade. Nas outras branches, um push novo cancela a execução antiga (economiza tempo).

**Rollback (voltar versão):** na EC2, `cd ~/cobranca && IMAGE_TAG=<sha do commit antigo> docker compose up -d`. Funciona porque cada imagem fica guardada no GHCR com a tag do commit.

**Por que o servidor não faz `git pull` e compila?** Porque assim o que roda em produção é **exatamente a imagem testada** pelo pipeline, o servidor não precisa de ferramentas de build nem do código-fonte, e voltar versão é trocar uma tag.

### 7.5 Dependabot

`.github/dependabot.yml`: todo mês abre PRs para a `develop` atualizando dependências (pip, npm, Docker, Actions), agrupadas e **sem versões maiores** (que podem quebrar). Os PRs passam pelo mesmo CI. O Celery fica na 5.6 (a 5.7 conflita com outra dependência).

### 7.6 Como eu opero a produção

- Acesso: `ssh -i cobranca-ec2.pem ubuntu@cobranca-tcc.duckdns.org`.
- `docker compose ps` (estado dos serviços), `docker compose logs -f --tail=100 api` (logs), `docker stats --no-stream` (memória/CPU).
- Snapshot do RDS antes de mudanças arriscadas; créditos conferidos semanalmente.

---

## 8. Qualidade, testes e desempenho

| Item | Número |
|---|---|
| Testes do back-end (pytest) | **802 testes**, ~**97%** de cobertura (mínimo exigido: 80%) |
| Testes do front-end (Vitest + Testing Library) | 71 testes, ~**91%** de cobertura em `lib`, `hooks`, `auth` (mínimo: 80%) |
| Qualidade estática | SonarCloud com Quality Gate; ESLint sem avisos; TypeScript estrito |
| **RNF01/RNF02** (100 usuários, P95 < 300 ms) | Teste de carga com **k6**: 100 usuários virtuais → **P95 de 75 e 99 ms**, 0% de falhas; com base de ~55.000 devedores → **P95 de 225 ms**, 0% de falhas |
| **RNF03** (lote de 50.000) | **115,7 s**, 49.999 novos + 1 atualizado, 0 rejeitados (~25.900 registros/min; meta > 10.000/min) |

**O que o teste de carga revelou e corrigi** (bom para mostrar maturidade):
- a linha do tempo do dashboard fazia **uma consulta por dia** → virou uma consulta só;
- a conexão do banco ficava presa entre o `get_current_user` e a rota → **impasse** entre o *threadpool* (40) e o *pool* de conexões (10) → corrigido;
- o RabbitMQ gastava CPU parado (*busy-wait*) → desligado também em produção.

**Por que o teste de carga foi local e não na produção?** A `t3.small` com crédito Padrão fica lenta quando acaba o crédito de CPU, e a latência até Ohio se soma ao tempo da API. O RNF02 mede o **tempo da API**, então o teste local, com a mesma configuração, isola o que interessa.

---

## 9. Decisões e desvios do RFC

| O RFC previa | O que foi feito | Por quê |
|---|---|---|
| Deploy em VPS com Docker | EC2 + RDS na AWS | Créditos acadêmicos; banco gerenciado com backup e criptografia |
| Nginx para TLS | **Caddy** | HTTPS automático (emite e renova o certificado), configuração bem menor |
| PostgreSQL em contêiner | RDS em produção (contêiner no dev e no CI) | Dados persistentes em serviço gerenciado |
| AWS SES/SNS | SendGrid (e-mail) e Twilio (SMS/WhatsApp) | Um provedor por canal + cliente simulado |
| Jest | Vitest | Integração nativa com o Vite, mesma API do Jest |
| Painel de "alertas" no dashboard | Distribuição por canal + conversão | Alertas já aparecem nos indicadores e no monitoramento |
| Exportar CSV de devedores | Não exporta | LGPD: arquivo solto com dados pessoais |
| "Esqueceu a senha?" por e-mail | "Fale com o administrador" | Sem e-mail transacional de recuperação; o admin redefine |
| Região no Brasil | Ohio | Custo (seção 6.3) |

---

## 10. Limitações e trabalho futuro

- **Instância única e banco Single-AZ:** se a máquina ou a zona cair, o sistema fica fora até recuperar. Produção real: múltiplas zonas (Multi-AZ, Auto Scaling, balanceador).
- **Twilio (SMS/WhatsApp) não configurada:** canais seguem simulados. WhatsApp em produção exige **templates aprovados pela Meta**.
- **Status `entregue`:** depende de **webhooks** dos provedores (não implementados); hoje "enviado" = aceito pelo provedor.
- **Retenção de 90 dias da auditoria** e **CSP** (Content-Security-Policy) não implementados.
- **Observabilidade em produção:** Prometheus/Grafana só no ambiente local.
- **Domínio gratuito** (DuckDNS); produção real: domínio próprio e região `sa-east-1`.

Saber as limitações e explicar o motivo de cada uma **conta a favor** na banca.

---

## 11. Perguntas prováveis e respostas

### Deploy e AWS

**"Como funciona o deploy?"**
> Eu trabalho numa branch `feature`, junto na `develop` e abro um PR para a `main`. A `main` é protegida: só aceita o PR se os quatro checks do GitHub Actions passarem (testes do back com 80% de cobertura e Quality Gate do SonarCloud, migrações num PostgreSQL real, build das imagens Docker e testes do front). Quando eu faço o merge, roda o job de Deploy, que espera minha aprovação manual no ambiente `producao`. Aprovado, ele constrói as imagens da API e do front, publica no GitHub Container Registry com a tag do commit, entra na EC2 por SSH, copia o docker-compose, faz `docker compose pull` e `up --wait`, que recria os contêineres e espera ficarem saudáveis, e no fim testa `https://dominio/health`. As migrações do banco rodam automaticamente quando a API sobe.

**"Como está configurado na AWS?"**
> Região Ohio. Uma EC2 `t3.small` com Ubuntu 24.04, 20 GB criptografados e swap de 2 GB, rodando seis contêineres com Docker Compose: Caddy, API, worker, beat, Redis e RabbitMQ. Um Elastic IP dá o IP fixo para o domínio do DuckDNS. O banco é um RDS PostgreSQL 15 `db.t4g.micro`, criptografado, sem acesso público e com TLS obrigatório. Dois security groups: o da EC2 libera 80, 443 e 22; o do RDS libera só a 5432 e só para o security group da EC2. Tenho orçamento de US$ 16/mês com alertas.

**"O que é um security group?"**
> É o firewall da AWS, aplicado a cada recurso. Define quais portas e de quais origens o tráfego pode entrar. É *stateful*: a resposta de uma conexão permitida sai sem regra extra. No RDS, em vez de liberar um IP, eu liberei o próprio security group da EC2, então só ela chega no banco.

**"Por que RDS e não o PostgreSQL num contêiner?"**
> Porque o banco é o único componente com dados que não posso perder. O RDS faz backup automático, criptografia e atualizações de segurança. Redis e RabbitMQ têm dados transitórios, então ficaram em contêineres na EC2 para não multiplicar o custo.

**"Por que Ohio e não São Paulo?"**
> Custo: São Paulo é das regiões mais caras, e eu tenho créditos limitados. Aceitei latência maior e dados fora do Brasil porque o TCC usa só dados fictícios. A LGPD permite transferência internacional com salvaguardas (art. 33). Para uso real, eu recriaria em `sa-east-1`; o código não depende da região.

**"Como o HTTPS funciona?"**
> O Caddy pede o certificado ao Let's Encrypt na primeira subida, prova que controla o domínio pela porta 80/443 e renova sozinho antes de vencer. Por isso precisei de um domínio (DuckDNS); certificado não é emitido para IP. O Caddy também redireciona HTTP para HTTPS e manda o cabeçalho HSTS.

**"Onde ficam as senhas e chaves?"**
> Nunca no Git. Em produção, num arquivo `.env` só na EC2, com permissão 600, e com cópia no meu gerenciador de senhas. As credenciais que o pipeline usa (chave SSH, endereço, known_hosts) ficam nos segredos do ambiente `producao` do GitHub. O login no GHCR usa o `GITHUB_TOKEN` temporário.

**"Como o GitHub entra na EC2 com segurança?"**
> Por SSH com chave privada guardada como segredo do ambiente. Além disso, eu guardo o `known_hosts` (a impressão digital do servidor) e uso `StrictHostKeyChecking yes`: se alguém se passar pelo servidor, o deploy recusa a conexão.

**"E se um deploy quebrar a produção?"**
> Primeiro, a chance é pequena: o código passou por quatro jobs e o `up --wait` falha se algum contêiner não ficar saudável; o teste de fumaça também falha o job. Se ainda assim precisar, faço rollback na EC2 com `IMAGE_TAG=<sha antigo> docker compose up -d`, porque cada versão fica guardada no GHCR com a tag do commit. Antes de migrações arriscadas, tiro snapshot do RDS.

**"E se a EC2 reiniciar?"**
> O Docker sobe com o sistema (`systemctl enable docker`) e os contêineres têm `restart: unless-stopped`, então voltam sozinhos. O Elastic IP mantém o mesmo endereço, e os certificados estão num volume persistente.

**"Qual a diferença entre CI e CD no seu projeto?"**
> CI são os quatro jobs que rodam em todo push e PR e garantem qualidade. CD é o job de Deploy, que só roda na `main`, publica as imagens e atualiza o servidor, com aprovação manual minha.

**"Quanto custa?"**
> A conta tem cerca de US$ 140 em créditos até maio de 2027. O RDS `db.t4g.micro` está no nível gratuito; o principal gasto é a EC2 e o IP público. Configurei orçamento de US$ 16/mês com alertas em 80% e 100%.

**"Por que Docker?"**
> Mesmo ambiente no meu PC, no CI e em produção; cada serviço isolado; subir tudo é um comando. E o deploy é trocar imagens, sem instalar nada no servidor. Isso atende o RNF09.

**"Por que Caddy e não Nginx?"**
> O Caddy faz a mesma função de proxy reverso, mas emite e renova o certificado HTTPS sozinho, com um arquivo de configuração de cerca de 40 linhas.

### Back-end e arquitetura

**"Por que fila (RabbitMQ) e worker (Celery)?"**
> Tarefas demoradas (processar planilha de 50.000 linhas, disparar mensagens) não podem rodar dentro da requisição HTTP. A API coloca a tarefa na fila e responde na hora; o worker processa em segundo plano. Se o worker cair, a tarefa continua na fila (`acks_late`).

**"Qual a diferença entre RabbitMQ e Redis no seu projeto?"**
> O RabbitMQ é o *broker*: transporta as tarefas da API/beat até o worker. O Redis é armazenamento rápido com expiração: guarda os tokens revogados, o contador de tentativas de login, a trava do ciclo de disparo e os resultados das tarefas do Celery.

**"Como você garante que o devedor não recebe a mesma mensagem duas vezes?"**
> Em várias camadas: a regra RN03 na consulta de elegíveis (sem comunicação bem-sucedida do canal hoje); restrição única no banco para um job por regra por dia; trava no Redis para não rodar dois ciclos ao mesmo tempo; `SELECT ... FOR UPDATE SKIP LOCKED` para dois workers nunca pegarem a mesma comunicação; e `commit` logo após cada envio.

**"Como funcionam os reenvios?"**
> Falha temporária agenda nova tentativa em 30 minutos, até 4 tentativas (RN07). Se cair fora da janela (depois das 20h, fim de semana ou feriado), vai para a próxima janela válida. Bounce (contato inválido) é definitivo na hora (RN08).

**"Como funciona a autenticação?"**
> Login gera dois JWT: access de 15 minutos e refresh de 7 dias, os dois em cookies httpOnly, Secure e SameSite=Lax. O JavaScript não vê o token, o que protege contra XSS. Quando o access expira, o front chama `/auth/refresh` uma vez e o refresh é rotacionado. No logout, o id do token (`jti`) vai para uma lista de revogados no Redis. Senhas com bcrypt custo 12. Cinco falhas de login geram bloqueio temporário.

**"Por que cookie e não localStorage?"**
> Token em localStorage pode ser lido por qualquer script injetado (XSS). Cookie httpOnly não é acessível pelo JavaScript.

**"Como funciona o controle de perfis?"**
> Cada rota tem `role_required` com os perfis permitidos; o back-end decide. O front só esconde botões que o perfil não pode usar, para a interface ficar limpa, mas a segurança real está na API.

**"Como você trata a LGPD?"**
> Valor da dívida criptografado com Fernet pela aplicação, além da criptografia do disco e do RDS; TLS até o banco; exclusão completa do devedor (art. 18) só pelo administrador; auditoria com IP; sem exportação de CSV; nada de CPF ou conteúdo de mensagem nos logs; e, no TCC, só dados fictícios.

**"O que é uma migração?"**
> Um script versionado (Alembic) que altera o esquema do banco. Tenho de `0001` a `0005`. A API aplica as pendentes ao subir, e o CI testa aplicar, conferir sincronia com os modelos e desfazer/refazer.

### Front-end

**"Como o front fala com o back?"**
> Toda chamada passa por `apiFetch`, com `fetch` nativo e `credentials: "include"` para mandar os cookies. Em 401, ele tenta um refresh compartilhado e repete; se falhar, volta ao login. Em produção, front e API estão no mesmo domínio, e o Caddy repassa as rotas da API sem prefixo por causa do cookie de refresh com `path=/auth`.

**"Como o front sabe o progresso do lote?"**
> Polling: consulta `GET /lotes/{id}` a cada poucos segundos até o status ser `concluido` ou `erro`. O worker atualiza o progresso a cada bloco de 1.000 linhas.

### Qualidade

**"Como você provou os requisitos de desempenho?"**
> Com k6: 100 usuários virtuais com pausa de 5 a 15 s entre ações (o ritmo real das telas, que atualizam a cada 15 e 60 s). P95 de 75 a 99 ms com 0% de falhas, e 225 ms com 55 mil devedores na base. O lote de 50.000 levou 115,7 s. O teste também revelou três problemas de desempenho que corrigi.

**"Qual a cobertura de testes?"**
> Back-end: 802 testes, cerca de 97%. Front-end: 71 testes, cerca de 91%. O CI falha abaixo de 80% nos dois.

---

## 12. Glossário

| Termo | Significado |
|---|---|
| **EC2** | Máquina virtual da AWS |
| **RDS** | Banco de dados relacional gerenciado da AWS |
| **VPC** | Rede virtual privada da conta AWS onde ficam EC2 e RDS |
| **Security group** | Firewall virtual da AWS por recurso |
| **Elastic IP** | IP público fixo da AWS |
| **EBS / gp3** | Disco da EC2 / tipo de disco SSD de uso geral |
| **AZ (zona de disponibilidade)** | Data center isolado dentro de uma região; Single-AZ = só um |
| **Snapshot** | Cópia do disco/banco num momento |
| **DNS** | "Lista telefônica" que traduz nome em IP |
| **TLS / HTTPS** | Criptografia da conexão / HTTP com TLS |
| **Let's Encrypt** | Autoridade certificadora gratuita e automática |
| **Proxy reverso** | Servidor na frente da aplicação que recebe e repassa as requisições (Caddy) |
| **Contêiner / imagem** | Processo isolado / pacote pronto para rodar |
| **Docker Compose** | Define e sobe vários contêineres juntos (um arquivo YAML) |
| **Registry (GHCR)** | Repositório de imagens Docker |
| **Healthcheck** | Verificação periódica se o serviço está saudável |
| **Runner** | Máquina temporária que executa os jobs do GitHub Actions |
| **Ruleset** | Regras de proteção de branch no GitHub |
| **Quality Gate** | Critério de aprovação do SonarCloud (bugs, vulnerabilidades, cobertura, duplicação) |
| **JWT** | Token assinado que identifica o usuário (com expiração) |
| **httpOnly** | Cookie que o JavaScript não lê |
| **bcrypt** | Algoritmo de hash de senha lento de propósito (dificulta força bruta) |
| **Fernet** | Criptografia simétrica autenticada (AES + HMAC) |
| **Broker** | Intermediário de mensagens (RabbitMQ) |
| **Idempotente** | Pode repetir sem efeito duplicado |
| **P95** | 95% das requisições respondem em até esse tempo |
| **Bounce** | Mensagem recusada definitivamente (contato inválido) |

---

## 13. Sugestão de roteiro da apresentação

| Tempo | Parte | O que mostrar |
|---|---|---|
| 1 min | Problema e solução | Seção 1 |
| 3 min | Demo ao vivo no site em produção | Login → Importar lote → Relatório → Devedores (filtros) → Régua (criar regra, pré-visualização) → Monitoramento → Dashboard |
| 3 min | Arquitetura | Diagrama da seção 2 + fluxo do disparo (3.5) |
| 4 min | **AWS e deploy** | Diagrama 6.2, caminho da requisição (6.4), pipeline (7.3/7.4). Se der, mostrar a aba Actions com um deploy verde e a aprovação |
| 2 min | Segurança e LGPD | Cookies httpOnly, bcrypt, Fernet, RBAC, security groups |
| 2 min | Qualidade e desempenho | Cobertura, SonarCloud, k6 (números da seção 8) |
| 1 min | Limitações e futuro | Seção 10 |

**Dicas para a hora:**
- Se não souber algo, diga o que sabe e onde está no código ("isso está no `ci.yml`, no job de deploy...").
- Tenha abertos em abas: o site, a aba **Actions** do GitHub, o `ci.yml`, o `docker-compose.prod.yml`, o `Caddyfile` e o console da AWS (EC2, RDS, security groups). Mostrar a configuração real responde melhor que qualquer explicação.
- **Não mostre o `.env` nem segredos na tela.** Se precisar mostrar o `.env` no SSH: `sed -E 's/=.+/=***/' .env`.
- Antes da apresentação: confira se o site abre e faz login (e, se for mexer em algo, tire um snapshot do RDS).
