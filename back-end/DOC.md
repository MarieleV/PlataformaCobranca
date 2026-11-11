# Documentação de Execução - Back-end

Este documento descreve como configurar, executar, testar e popular o banco de dados da **Plataforma de Cobrança Automatizada**.

O back-end é construído com **Python 3.14**, **FastAPI** e orquestrado via **Docker** (PostgreSQL 15, Redis, RabbitMQ, worker e agendador Celery).

---

## 📌 Roadmap e Status do Projeto (Baseado na RFC v1.1)

### ✅ Concluído
- [x] **M1: Setup Base:** FastAPI, Docker (6 serviços com healthchecks), PostgreSQL, Redis e RabbitMQ.
- [x] **M1: Modelagem de Dados:** tabelas em `snake_case` com SQLAlchemy (Usuários, Lotes, Erros, Devedores, Regras, Jobs, Comunicações e Auditoria), valor da dívida criptografado (Fernet) e índices.
- [x] **Migrações (Alembic):** versionamento do esquema (`0001` a `0005`), aplicado automaticamente na subida da API.
- [x] **M3: Autenticação Segura:** JWT em cookies `HttpOnly` (acesso 15 min, refresh 7 dias com rotação), revogação no Redis, bloqueio após 5 tentativas e invalidação de sessões ao trocar a senha ou desativar a conta.
- [x] **M3: Controle de Acesso (RBAC, RN06):** Administrador (total), Gestor (gerencia só operadores) e Operador.
- [x] **UC07: Gestão de Usuários:** criar, editar, ativar/desativar, redefinir senha, excluir e trocar a própria senha.
- [x] **RF11: Log de Auditoria:** registro das ações sensíveis e consulta com filtros (`GET /auditoria/`, só Administrador).
- [x] **M2: Ingestão e Validação (Worker):** `.csv`, `.xlsx` e `.xls` com `pandas`, relatório de erros por linha, blocos de 1000, processamento idempotente. **Reimportação atualiza** os devedores já existentes (exceto os quitados).
- [x] **M3: Régua de Cobrança (UC03/RF04):** CRUD de regras por dias de atraso, canal, horário e template com variáveis; pré-visualização; uma regra ativa por canal e prazo.
- [x] **M4: Disparo Multicanal:** e-mail (SendGrid), SMS e WhatsApp (Twilio) e um cliente simulado para desenvolvimento.
- [x] **M4: Reenvios (RN07/RN08):** 1 envio + 3 reenvios a cada 30 minutos; e-mail ou telefone inválido (*bounce*) é falha definitiva.
- [x] **M4: Agendamento (Celery Beat):** ciclo a cada 5 minutos, de segunda a sexta, das 8h às 19h, respeitando a janela de 08h às 20h e os **feriados** (RN05) e a regra de uma comunicação por canal por dia (RN03).
- [x] **RF06/RF07: Jobs:** acompanhamento dos disparos e das comunicações de cada job.
- [x] **RF08: Dashboard:** disparos, taxa de entrega, taxa de conversão, distribuição por canal e linha do tempo.
- [x] **RNF08: Métricas:** endpoint `/metrics` (Prometheus) e Grafana opcional.
- [x] **M5: Qualidade (RNF06):** 783 testes automatizados (Pytest) com 97% de cobertura.
- [x] **M5: CI/CD (RNF07):** GitHub Actions com testes, migrações em PostgreSQL, build do Docker e SonarCloud com Quality Gate bloqueando o deploy.
- [x] **Seed Inicial:** cria o Administrador padrão (recusa a senha padrão em produção).

### ⏳ Pendente
- [ ] **Integração com o front-end.**
- [ ] **Teste real dos provedores** (SendGrid e Twilio) e autenticação de domínio do remetente.
- [ ] **Deploy na AWS** (RDS PostgreSQL, EC2) e o passo de deploy do CI.
- [ ] **Webhooks de status de entrega** (SendGrid/Twilio) para registrar `entregue`.
- [ ] **Templates aprovados do WhatsApp** (em produção, mensagens iniciadas pela empresa exigem templates).

---

## 📌 Roadmap e Status do Projeto (Baseado na RFC v1.1)

Abaixo está o acompanhamento das entregas do back-end conforme o planejamento do projeto:

### ✅ Concluído (Feito)
- [x] **M1: Setup Base:** Estrutura inicial com FastAPI, Docker, PostgreSQL, Redis e RabbitMQ.
- [x] **M1: Modelagem de Dados:** Tabelas padronizadas em `snake_case` com SQLAlchemy (Usuários, Lotes, Erros, Devedores, Regras, Jobs e Comunicações).
- [x] **M3: Autenticação Segura:** Login/Logout via JWT com proteção contra XSS utilizando cookies `HttpOnly`.
- [x] **M3: Controle de Acesso (RBAC):** Proteção de rotas baseada nos papéis de Administrador, Gestor e Operador.
- [x] **M2/M3: DTOs Pydantic:** Padronização de entrada e saída (schemas) para Lotes e Usuários.
- [x] **M5: Qualidade de Código (TDD):** Implementação da suíte de testes automatizados offline com Pytest e Mocks (TestClient) para a camada de segurança.
- [x] **Seed Inicial:** Script para criação do Administrador padrão na primeira execução do banco.

### ⏳ Pendente (A Fazer)
- [ ] **M2: Ingestão e Validação (Worker):** Processamento de arquivos `.csv`, `.xlsx` e `.xls` usando `pandas`, com relatório de erros por linha.
- [ ] **M3: Régua de Cobrança:** CRUD para configurar regras baseadas em dias de atraso, canal, horário e template de mensagem.
- [ ] **M4: Processamento Assíncrono (Celery):** Integração do `Celery` consumindo o `RabbitMQ` para disparo das comunicações.
- [ ] **M4: Disparo Multicanal e Reenvios:** Integração com APIs externas (SendGrid, Twilio, WhatsApp) e lógica de até 4 tentativas de envio.
- [ ] **M4: Agendamento Recorrente (Celery Beat):** Orquestração dos jobs automáticos respeitando dias úteis e horário comercial (08h às 20h).
- [ ] **M5: Observabilidade e CI/CD:** Métricas expostas via Prometheus/Grafana e Quality Gate configurado via SonarCloud e GitHub Actions.

---

## ⚠️ Pré-requisitos

- **Docker Desktop** aberto, com a Engine rodando.
- **Git**.
- Para rodar os testes fora do Docker: **Python 3.14**.

---

## 🚀 Passo a Passo para Rodar o Sistema

### 1. Configurar o `.env`
Na pasta `back-end`, copie o modelo e preencha:

```bash
copy .env.example .env
```

Gere os dois segredos obrigatórios e cole no `.env`:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"                       # JWT_SECRET
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"   # ENCRYPTION_KEY
```

Mantenha `ENVIO_SIMULADO=true` enquanto não houver chaves reais dos provedores.

### 2. Iniciar os containers
```bash
docker compose up -d --build
```
A API aplica as migrações do banco sozinha (`alembic upgrade head`) ao subir. Para conferir:

```bash
docker compose exec api alembic current     # deve mostrar: 0005 (head)
```

### 3. Verificar se a API está online
- Health check simples: **http://localhost:8000/**
- Saúde dos serviços (Postgres, Redis e RabbitMQ): **http://localhost:8000/health**
- Documentação interativa: **http://localhost:8000/docs**

### 4. Carga inicial (Seed)
```bash
docker exec -it cobranca_api python -m app.seed
```

**Credenciais criadas pelo Seed (apenas desenvolvimento):**
- **E-mail:** `admin@consulth.com.br`
- **Senha:** `admin123`

Em produção, defina `ADMIN_SENHA_INICIAL` no `.env`: o seed recusa a senha padrão.

---

## 🧪 Testes

Os testes rodam sem Docker (banco SQLite temporário e Redis simulado). Dentro do ambiente virtual:

```bash
python -m venv venv
venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
pytest --cov=app --cov-report=term
```

O CI exige **cobertura mínima de 80%** (RNF06).

---

## 🔁 CI/CD (GitHub Actions + SonarCloud)

O fluxo está em `.github/workflows/ci.yml` e roda a cada push e pull request para `main` e `develop`:

| Job | O que faz |
|---|---|
| **Testes e SonarCloud** | roda os testes (falha abaixo de 80% de cobertura) e envia a análise ao SonarCloud, esperando o Quality Gate |
| **Migrações no PostgreSQL** | aplica as migrações em um PostgreSQL 15 real, confere se os modelos e as migrações estão em sincronia (`alembic check`) e testa desfazer/refazer |
| **Build da imagem Docker** | garante que o `Dockerfile` continua construindo |
| **Deploy** | só roda na `main` e **só se os três anteriores passarem** (RNF07) |

**Configuração necessária (uma vez):**
1. SonarCloud → *My Account → Security* → gerar um token.
2. GitHub → *Settings → Secrets and variables → Actions* → criar o secret `SONAR_TOKEN` com esse token.
3. SonarCloud → projeto → *Administration → Analysis Method* → **desligar a Análise Automática** (ela conflita com a análise do CI).
4. GitHub → *Settings → Branches* → regra de proteção para `main` exigindo os checks acima antes do merge.

---

## 📊 Métricas e Monitoramento (RNF08)

- **Métricas:** `http://localhost:8000/metrics` (formato Prometheus). Defina `METRICS_TOKEN` no `.env` para exigir `Authorization: Bearer <token>` e, em produção, bloqueie a rota para a internet.
- **Prometheus e Grafana (opcional):**

```bash
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
```
Prometheus em `http://localhost:9090` e Grafana em `http://localhost:3000` (usuário `admin`; defina `GRAFANA_ADMIN_PASSWORD` no `.env`).

---

## 📨 Testando os provedores reais

Com as chaves no `.env` (`SENDGRID_API_KEY`, `EMAIL_REMETENTE`, `TWILIO_*`), envie **uma** mensagem de teste, sem tocar no banco e sem desligar o modo simulado:

```bash
docker compose up -d --force-recreate api
docker compose exec api python -m app.testar_provedores email seu-email@exemplo.com
docker compose exec api python -m app.testar_provedores sms 47999990000
docker compose exec api python -m app.testar_provedores whatsapp 47999990000
```

Só depois de validar, troque `ENVIO_SIMULADO=false` (em produção, todas as chaves são obrigatórias).

---

## 🧩 Regras de negócio em resumo

- **Elegibilidade:** o devedor entra na régua quando os dias de atraso são **exatamente** os da regra, o status é `ativo` ou `comunicado` e há contato para o canal.
- **RN03:** no máximo uma comunicação bem-sucedida por devedor, canal e dia.
- **RN05:** disparos só de segunda a sexta (exceto feriados), das 08h às 20h (Brasília). Feriados nacionais, Sexta-feira Santa, Carnaval e Corpus Christi; extras em `FERIADOS_EXTRAS`.
- **RN07/RN08:** até 4 tentativas, 30 minutos entre elas; destino inválido é falha definitiva.
- **Status do devedor:** só Gestor e Administrador marcam `quitado`, e um devedor quitado não é reaberto nem atualizado por reimportação.
- **Taxas do dashboard:** *taxa de entrega* = comunicações com sucesso ÷ todas as geradas no período; *taxa de conversão* = devedores alcançados que hoje estão quitados.

### Limitações conhecidas
- Se o sistema ficar fora do ar o dia inteiro, o job daquele dia não é criado depois; use `POST /regras/{id}/executar` (até 7 dias para trás).
- `entregue` depende de webhooks dos provedores (ainda não implementados): hoje "enviado" significa aceito pelo provedor.
- Não há valores em R$ no dashboard (o valor da dívida é criptografado).

---

## 🛠️ Comandos Úteis para o Dia a Dia

**Parar todos os serviços:**
```bash
docker compose down
```

**Logs em tempo real** (API, worker ou beat):
```bash
docker compose logs -f api
docker compose logs -f worker
docker compose logs -f beat
```

**Disparar a régua manualmente** (ex.: após uma falha do sistema), via `POST /regras/{id}/executar`.

**Limpar imagens órfãs do Docker:**
```bash
docker image prune -f
```

---
## 🏗️ Arquitetura Rodando nas Portas Locais

* **FastAPI (Back-end):** `localhost:8000`
* **PostgreSQL:** `localhost:5433` (a porta 5432 do container é mapeada para a 5433 do seu computador)
* **Redis:** `localhost:6379`
* **RabbitMQ (AMQP):** `localhost:5672`
* **RabbitMQ (Painel Web):** `localhost:15672` (usuário e senha: `RABBITMQ_USER` e `RABBITMQ_PASSWORD` do `.env`)
* **Prometheus / Grafana (opcional):** `localhost:9090` / `localhost:3000`
