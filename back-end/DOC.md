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