<p align="center">
  <img src="https://files.engaged.com.br/5db0810e95b4f900077e887e/account/5db0810e95b4f900077e887e/xMCS8NFKTMqwhefy8WLd_catolica-horizontal.png" alt="Católica SC" width="260"/>
</p>

<h1 align="center">Plataforma de Cobrança Automatizada</h1>

<p align="center">
  <strong>Engenharia de Software — Católica SC</strong><br/>
  Projeto de Portfólio · Linha Web / Dados / Automação
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11-blue?logo=python" alt="Python"/>
  <img src="https://img.shields.io/badge/FastAPI-0.110-009688?logo=fastapi" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react" alt="React"/>
  <img src="https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql" alt="PostgreSQL"/>
  <img src="https://img.shields.io/badge/RabbitMQ-broker-FF6600?logo=rabbitmq" alt="RabbitMQ"/>
  <img src="https://img.shields.io/badge/Docker-containerized-2496ED?logo=docker" alt="Docker"/>
  <img src="https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088FF?logo=githubactions" alt="CI/CD"/>
  <img src="https://img.shields.io/badge/Quality-SonarCloud-F3702A?logo=sonarcloud" alt="SonarCloud"/>
</p>

---

## 1. Visão do Produto e Impacto

### 1.1 Contexto e Problema

A inadimplência é um desafio estrutural para empresas de diversos segmentos no Brasil. O país ultrapassa **70 milhões de pessoas físicas inadimplentes**, e empresas de médio porte perdem, em média, entre **3% e 8%** da receita bruta anual em decorrência de cobranças mal executadas ou não realizadas.

O processo tradicional de cobrança é majoritariamente **manual**: analistas financeiros exportam planilhas do ERP, filtram devedores individualmente, enviam e-mails um a um e registram contatos em outros sistemas. Esse fluxo apresenta limitações críticas:

- ❌ Alto custo operacional com tarefas repetitivas e de baixo valor
- ❌ Inconsistência na régua de comunicação — cada analista aplica regras diferentes
- ❌ Ausência de rastreabilidade e auditoria das ações realizadas
- ❌ Impossibilidade de escalar sem aumentar o quadro de funcionários
- ❌ Dados de retorno não realimentam o sistema de forma automatizada

Este projeto propõe substituir esse fluxo por uma **plataforma web integrada** que automatiza a ingestão de dados de inadimplentes, aplica réguas de cobrança configuráveis e executa disparos de comunicação multicanal (e-mail, SMS, WhatsApp) de forma programada e monitorada.

---

### 1.2 Origem da Demanda e Evidências

Foram realizadas entrevistas exploratórias com 5 profissionais da área financeira e 15 profissionais da área de cobrança da empresa parceira. Principais achados:

| Achado | % dos Entrevistados |
|---|---|
| Processo de envio de comunicações de cobrança realizado manualmente | 100% |
| Sem rastreabilidade sobre quais devedores receberam qual tipo de comunicação | 80% |
| Dificuldade em manter régua padronizada entre analistas | 100% |
| Sem solução dedicada integrada (usam combinações de planilhas Excel, e-mail corporativo e sistemas legados) | 100% |

---

### 1.3 Análise de Soluções Existentes (Benchmark)

| Solução | Público-Alvo | Pontos Fortes | Limitações |
|---|---|---|---|
| Receita Certa | PMEs | Interface amigável, integração com Pix | Sem customização de régua, sem importação por CSV |
| Assertiva Cobranças | Empresas de médio porte | Automação básica de comunicação | Custo elevado, sem observabilidade |
| Iugu / Vindi | E-commerce e SaaS | Plataforma de pagamentos robusta | Foco em recorrência, não em cobranças de carteira |
| Planilha + Disparador de e-mail | Qualquer empresa | Baixo custo, familiar | Sem automação, sem rastreabilidade, sem escala |

> **Diferencial:** nenhuma das soluções analisadas oferece simultaneamente: (1) importação flexível de lotes via CSV/Excel com validação automatizada; (2) configuração visual da régua de cobrança por perfil de devedor; (3) execução de jobs programados com monitoramento em tempo real via dashboard. O projeto preenche essa lacuna com uma arquitetura moderna, open source e auditável.

---

### 1.4 Público-Alvo

O sistema é direcionado a **empresas de médio porte** — cooperativas, varejistas, clínicas e prestadoras de serviço — que realizam a gestão interna de suas carteiras de inadimplentes. O projeto é desenvolvido em parceria com a **Consulth Soluções Empresariais**, especializada em recuperação de crédito e cobrança B2B.

| Perfil | Descrição |
|---|---|
| **Analista de Cobrança / Financeiro** (usuário primário) | Possui nível intermediário de conhecimento tecnológico, realiza importações de lotes e monitora disparos via portal web. |
| **Gestor Financeiro** (usuário secundário) | Configura os parâmetros estratégicos da régua de cobrança e analisa métricas no dashboard. |
| **Administrador** | Gerencia usuários, permissões e configurações globais do sistema. |

---

### 1.5 Objetivos do Projeto

**Objetivo Geral:** Desenvolver uma plataforma web para automação do ciclo de cobrança de inadimplentes, desde a ingestão e validação de dados até o disparo multicanal de comunicações e o monitoramento dos resultados, com arquitetura orientada a qualidade, segurança e observabilidade.

**Objetivos Específicos:**

1. Implementar um pipeline assíncrono de ingestão e validação de arquivos CSV/Excel com feedback detalhado de erros por linha.
2. Desenvolver um módulo de configuração visual da régua de cobrança, permitindo definir canais e prazos por perfil de devedor.
3. Automatizar a execução de jobs de disparo de comunicações (e-mail e SMS) com agendamento configurável.
4. Criar um dashboard de monitoramento com métricas de execução, taxa de entrega e taxa de conversão.
5. Garantir qualidade de código com TDD, CI/CD automatizado e análise estática via SonarCloud.

---

### 1.6 Métricas de Sucesso (KPIs)

| KPI | Meta |
|---|---|
| Tempo de resposta da API (P95) | < 300ms |
| Throughput de processamento de lote | > 10.000 registros/minuto |
| Cobertura de testes automatizados (backend) | ≥ 80% |
| Cobertura de testes (frontend) | ≥ 25% |
| Disponibilidade do serviço | ≥ 99% |
| Taxa de sucesso nos disparos de e-mail | > 95% |
| Qualidade Sonar Cloud (Quality Gate) | Aprovado (sem blockers/criticals) |

---

<p align="center">
  <sub>Documento técnico completo disponível em <code>/docs/documentacao_v2.md</code> e no <a href="https://www.figma.com/design/aTgE91sZyzbxTrB8kh5clh/Plataforma-de-Cobran%C3%A7a-Automatizada?node-id=0-1&t=vxq6D6561lNc1dOZ-1">Figma do Projeto</a>.</sub>
</p>
