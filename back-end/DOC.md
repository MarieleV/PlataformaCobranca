# Documentação de Execução - Back-end

Este documento descreve os passos necessários para configurar, executar e popular o banco de dados da **Plataforma de Cobrança Automatizada**. 

O back-end é construído com **Python 3.14**, **FastAPI** e orquestrado inteiramente via **Docker** (incluindo PostgreSQL 15, Redis e RabbitMQ).

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

Antes de começar, certifique-se de ter os seguintes itens instalados e rodando na sua máquina:
- **Docker Desktop** (Obrigatório estar aberto e com a "Engine" rodando).
- **Git** (Para controle de versão).

---

## 🚀 Passo a Passo para Rodar o Sistema

### 1. Iniciar os Containers (Primeira vez ou após atualizações)
Abra o seu terminal de preferência, navegue até a pasta `back-end` e execute o comando abaixo para construir a imagem da API e subir todos os serviços de uma vez:

```bash
docker compose up -d --build

```

*A flag `-d` roda os serviços em segundo plano, liberando o seu terminal.*

### 2. Verificar se a API está online

Após o comando finalizar, você pode verificar se o back-end está operante acessando a rota de *Health Check* no seu navegador:
👉 **[http://localhost:8000/](http://localhost:8000/)**

### 3. Carga Inicial do Banco de Dados (Seed)

Como o banco de dados PostgreSQL nasce vazio, é necessário rodar o script de seed para criar o usuário Administrador padrão com permissão total de acesso.

Com os containers rodando, execute no terminal:

```bash
docker exec -it cobranca_api python -m app.seed

```

**Credenciais criadas pelo Seed:**

* **E-mail:** `admin@consulth.com.br`
* **Senha:** `admin123`

---

## 🛠️ Comandos Úteis para o Dia a Dia

**Derrubar/Desligar todos os serviços:**
Caso queira parar o banco, a fila, o cache e a API, rode:

```bash
docker compose down

```

**Ver os logs da API em tempo real:**
Se algo der erro na integração com o front-end, você pode acompanhar os logs do FastAPI com:

```bash
docker compose logs -f api

```

**Fazer a "Faxina" no Docker (Liberar espaço em disco):**
Como o comando `--build` gera novas imagens e deixa as antigas "órfãs" no seu computador, rode este comando de vez em quando para limpar o lixo espacial e liberar espaço no HD:

```bash
docker image prune -f

```

---
## 🏗️ Arquitetura Rodando nas Portas Locais

* **FastAPI (Back-end):** `localhost:8000`
* **PostgreSQL (Banco de Dados):** `localhost:5432`
* **Redis (Cache/Sessão):** `localhost:6379`
* **RabbitMQ (Fila de Mensagens):** `localhost:5672`
* **RabbitMQ (Painel Web de Administração):** `localhost:15672` (Usuário: `guest`, Senha: `guest`)

```
