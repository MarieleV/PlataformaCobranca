# Documentação de Execução - Back-end

Este documento descreve os passos necessários para configurar, executar e popular o banco de dados da **Plataforma de Cobrança Automatizada**. 

O back-end é construído com **Python 3.14**, **FastAPI** e orquestrado inteiramente via **Docker** (incluindo PostgreSQL 15, Redis e RabbitMQ).

---

## ⚠️ Pré-requisitos

Antes de começar, certifique-se de ter os seguintes itens instalados e rodando na sua máquina:
* **Docker Desktop** (Obrigatório estar aberto e com a "Engine" rodando).
* **Git** (Para controle de versão).

---

## 🚀 Passo a Passo para Rodar o Sistema

### 1. Iniciar os Containers (Primeira vez ou após atualizações)
Abra o seu terminal de preferência, navegue até a pasta `back-end` e execute o comando abaixo para construir a imagem da API e subir todos os serviços de uma vez:

```bash
docker compose up -d --build

---


Com certeza! É sempre uma excelente prática ter um arquivo de documentação (como um `README.md` ou `DOC.md`) na raiz do projeto para que você ou qualquer outra pessoa da equipe saiba exatamente como rodar o sistema no futuro.

Aqui está o conteúdo formatado em Markdown. Você pode criar um arquivo chamado **`DOC.md`** (ou `README.md`) dentro da sua pasta `back-end` e copiar todo o conteúdo abaixo para dentro dele:

```markdown
# Documentação de Execução - Back-end

Este documento descreve os passos necessários para configurar, executar e popular o banco de dados da **Plataforma de Cobrança Automatizada**[cite: 1]. 

O back-end é construído com **Python 3.14**, **FastAPI** e orquestrado inteiramente via **Docker** (incluindo PostgreSQL 15, Redis e RabbitMQ)[cite: 1].

---

## ⚠️ Pré-requisitos

Antes de começar, certifique-se de ter os seguintes itens instalados e rodando na sua máquina:
* **Docker Desktop** (Obrigatório estar aberto e com a "Engine" rodando).
* **Git** (Para controle de versão).

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


