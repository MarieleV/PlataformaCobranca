<p align="center">
  <img src="https://files.engaged.com.br/5db0810e95b4f900077e887e/account/5db0810e95b4f900077e887e/xMCS8NFKTMqwhefy8WLd_catolica-horizontal.png" alt="Católica SC" width="220"/>
</p>

<h1 align="center">Plataforma de Cobrança Automatizada</h1>

<p align="center">
  <strong>Engenharia de Software — Católica SC</strong><br/>
  Projeto de Portfólio · SaaS Fintech B2B · Automação e Mensageria Assíncrona
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/React_18-20232A?logo=react&logoColor=61DAFB" alt="React"/>
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?logo=tailwind-css&logoColor=white" alt="Tailwind CSS"/>
  <img src="https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white" alt="Vite"/>
  <span style="margin: 0 4px;">|</span>
  <img src="https://img.shields.io/badge/Python_3.11-14354C?logo=python&logoColor=white" alt="Python"/>
  <img src="https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/PostgreSQL-316192?logo=postgresql&logoColor=white" alt="PostgreSQL"/>
  <img src="https://img.shields.io/badge/RabbitMQ-FF6600?logo=rabbitmq&logoColor=white" alt="RabbitMQ"/>
  <img src="https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white" alt="Docker"/>
</p>

---

## 1. Visão Arquitetural

O sistema foi desenhado sob uma arquitetura de microsserviços e processamento assíncrono para suportar alta volumetria de dados. O objetivo principal é automatizar o ciclo completo de inadimplência corporativa, substituindo processos manuais e descentralizados (planilhas soltas e e-mails manuais) por um pipeline auditável, escalável e integrado.

### Fluxo de Dados (Data Pipeline)
1. **Ingestão:** Upload de planilhas (CSV/XLSX) via portal Web.
2. **Mensageria (RabbitMQ):** O arquivo é enfileirado para evitar bloqueio da thread principal da API.
3. **Processamento (Workers):** Serviços em background (Celery) validam os dados utilizando `Pandas`, aplicando regras de negócio rigorosas (validação de CPF/CNPJ, valores, formatos).
4. **Orquestração (Scheduler):** Uma *cron* avalia diariamente os devedores elegíveis com base nas réguas de cobrança dinâmicas.
5. **Disparo Multicanal:** Integração com APIs externas (SendGrid, Twilio, Meta) para envio de E-mail, SMS e WhatsApp.

---

## 2. Tecnologias e Stack

### 🎨 Front-End (Web App)
- **Framework & Build:** React 18 com Vite, garantindo HMR instantâneo e bundle otimizado.
- **Linguagem:** TypeScript estrito para segurança de tipagem de *models* e respostas da API.
- **Styling & UI/UX:** Tailwind CSS aplicado sob um Design System *High-End*.
- **Roteamento & Estado:** Roteamento de Single Page Application (SPA) com controle de sessão via JWT.

### ⚙️ Back-End & Infraestrutura
- **Core API:** FastAPI (Python 3.11) priorizando performance e documentação autogerada (OpenAPI/Swagger).
- **Processamento de Dados:** Pandas para validação massiva de lotes de importação.
- **Brokers & Workers:** RabbitMQ + Celery + Redis para gerenciamento de filas e execução de tarefas assíncronas.
- **Persistência:** PostgreSQL como banco de dados relacional primário.
- **Containerização:** Orquestração completa de ambientes via Docker e Docker Compose.

---

## 3. Design System e Implementação de UI/UX

A interface foi projetada visando um padrão **SaaS Corporativo Premium**, com forte inspiração em ferramentas modernas para desenvolvedores e financeiro (ex: Vercel, Stripe).

- **Clean UI & Dark Mode Semântico:** Utilização intensiva da paleta monocromática (`slate-50` para fundos expansivos, `black` puro para botões primários e painéis de conversão).
- **Redução de Carga Cognitiva:** Cores vibrantes (Azul, Verde, Roxo e Vermelho) foram transformadas em tons pastéis sutis, aplicados exclusivamente onde são necessários para indicar *status* e canais semânticos (SMS, WhatsApp, Email).
- **Componentização:** Utilização de bordas arredondadas modernas (`rounded-2xl` e `rounded-3xl`), sombras suaves acopladas com o tom do componente (`shadow-black/10`), e tipografia geométrica (`Inter` / `font-sans`).

---

## 4. Módulos e Funcionalidades Principais

### 📥 Importador de Lotes e Validador (Pandas)
- Pipeline assíncrono com feedback de progresso em tempo real no front-end.
- Validação estrita linha a linha (RN01-RN04).
- Geração automática de **Relatório de Inconsistências** detalhando a célula e a regra violada antes da consolidação no banco.

### 📏 Motor de Regras (Régua de Cobrança)
- Interface visual para configuração de *workflows* de cobrança (`D+5`, `D+15`, `D+30`).
- Suporte a templates dinâmicos com interpolação de variáveis em tempo real (ex: `{nome}`, `{valor}`).
- Vinculação de canais de disparo específicos por etapa (Escalada de cobrança).

### 🖥️ Console de Monitoramento (Live Logs)
- Terminal simulado na web para observabilidade do sistema.
- Acompanhamento do log dos *workers*, status das filas (`RabbitMQ`), consumo de memória (`Redis`) e latência/retorno de APIs de mensageria de terceiros (`SendGrid`, `Twilio`).

### 👥 Gestão de Acesso Baseada em Perfis (RBAC)
- Arquitetura de permissões segregada: `Administrador`, `Gestor` e `Operador`.
- Proteção de rotas sensíveis e controle de ações globais na aplicação.

---

## 5. Qualidade e CI/CD

O projeto segue metodologias rigorosas de Engenharia de Software para garantir a sustentabilidade do código a longo prazo:

- **CI/CD:** Pipelines automatizados no **GitHub Actions** para Linting, Build e Run de testes a cada Pull Request.
- **Análise Estática:** Integração com **SonarCloud** para garantir o *Quality Gate* (Zero bugs críticos, vulnerabilidades ou Code Smells na master).
- **Testes Automatizados:** 
  - Backend: `pytest` focado nos *core flows* (cálculo de régua, parsers e validação de CSV). Meta: ≥ 80%.
  - Frontend: Testes unitários para lógica de renderização de componentes críticos. Meta: ≥ 25%.
- **Disponibilidade Alvo:** Arquitetura desenhada para SLA de 99% e tempo de resposta de API (P95) inferior a 300ms.

---

<p align="center">
  <sub>Documentação arquitetural aprofundada disponível em <code>/docs</code> e wireframes no <a href="https://www.figma.com/design/aTgE91sZyzbxTrB8kh5clh/Plataforma-de-Cobran%C3%A7a-Automatizada">Figma do Projeto</a>.</sub><br/>
  <sub>© 2026 Plataforma de Cobrança Automatizada. Desenvolvido para TCC - Engenharia de Software.</sub>
</p>