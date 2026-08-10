<p align="center">
  <img src="https://files.engaged.com.br/5db0810e95b4f900077e887e/account/5db0810e95b4f900077e887e/xMCS8NFKTMqwhefy8WLd_catolica-horizontal.png" alt="Católica SC" width="220"/>
</p>

<h1 align="center">Plataforma de Cobrança Automatizada</h1>

<p align="center">
  <strong>Engenharia de Software — Católica SC</strong><br/>
  Projeto de Portfólio · SaaS Fintech B2B · Automação e Mensageria Assíncrona
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/React_18-20232A?style=flat-square&logo=react&logoColor=61DAFB" alt="React"/>
  <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS"/>
  <img src="https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite"/>
</p>
<p align="center">
  <img src="https://img.shields.io/badge/Python_3.11-3776AB?style=flat-square&logo=python&logoColor=FFD43B" alt="Python"/>
  <img src="https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL"/>
  <img src="https://img.shields.io/badge/RabbitMQ-FF6600?style=flat-square&logo=rabbitmq&logoColor=white" alt="RabbitMQ"/>
  <img src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker"/>
</p>

---

## Sobre o Projeto

Empresas B2B que operam com carteiras de cobrança ainda dependem, em grande parte, de planilhas soltas e disparos manuais de e-mail para gerenciar inadimplência. Esse processo é lento, sujeito a erro humano e não escala.

A **Plataforma de Cobrança Automatizada** resolve esse problema com um pipeline auditável e escalável: da importação em lote à validação dos dados, passando pela orquestração de réguas de cobrança e o disparo multicanal (e-mail, SMS e WhatsApp), tudo de forma automática e monitorável em tempo real.

O projeto foi desenvolvido como Trabalho de Conclusão de Curso em Engenharia de Software, com padrões de arquitetura e qualidade equivalentes aos de um produto SaaS em produção.

---

## Arquitetura

O sistema segue uma arquitetura orientada a mensageria, desacoplando a ingestão de dados do seu processamento para suportar alta volumetria sem travar a API.

```
Upload (Web) → API (FastAPI) → Fila (RabbitMQ) → Workers (Celery)
                                                        │
                                                        ▼
                                        Validação (Pandas) → PostgreSQL
                                                        │
                                                        ▼
                                    Scheduler diário avalia réguas de cobrança
                                                        │
                                                        ▼
                                Disparo multicanal (SendGrid · Twilio · Meta)
```

**Fluxo de dados:**

1. **Ingestão** — upload de planilhas (CSV/XLSX) via portal web.
2. **Mensageria** — o arquivo é enfileirado no RabbitMQ para não bloquear a thread principal da API.
3. **Processamento** — workers em background (Celery) validam os dados com Pandas, aplicando regras de negócio (CPF/CNPJ, valores, formatos).
4. **Orquestração** — uma rotina diária (cron) avalia quais devedores são elegíveis, com base em réguas de cobrança configuráveis.
5. **Disparo multicanal** — integração com APIs externas (SendGrid, Twilio, Meta) para envio de e-mail, SMS e WhatsApp.

---

## Stack Tecnológica

### Front-end
| Camada | Tecnologia | Papel |
|---|---|---|
| Build & Framework | React 18 + Vite | HMR instantâneo e bundle otimizado |
| Linguagem | TypeScript (strict) | Tipagem segura de models e respostas da API |
| Estilo | Tailwind CSS | Design system corporativo (ver seção UI/UX) |
| Roteamento & Sessão | SPA com JWT | Controle de sessão e rotas protegidas |

### Back-end
| Camada | Tecnologia | Papel |
|---|---|---|
| API | FastAPI (Python 3.11) | Performance e documentação OpenAPI/Swagger autogerada |
| Processamento de dados | Pandas | Validação massiva de lotes de importação |
| Filas & Workers | RabbitMQ + Celery + Redis | Execução assíncrona e gerenciamento de filas |
| Persistência | PostgreSQL | Banco de dados relacional primário |
| Infraestrutura | Docker + Docker Compose | Orquestração de ambientes |

---

## Design System

A interface segue um padrão **SaaS corporativo premium**, com inspiração em ferramentas como Vercel e Stripe.

- **Clean UI & dark mode semântico** — paleta monocromática (`slate-50` para fundos, preto puro em botões primários e painéis de conversão).
- **Redução de carga cognitiva** — cores vibrantes (azul, verde, roxo, vermelho) aparecem apenas em tons pastéis sutis, reservadas para indicar status e canais (SMS, WhatsApp, e-mail).
- **Componentização consistente** — bordas arredondadas (`rounded-2xl`/`rounded-3xl`), sombras suaves acopladas ao tom do componente (`shadow-black/10`) e tipografia geométrica (`Inter`).

---

## Módulos Principais

- 📥 **Importador de Lotes e Validador**
  - **Pipeline Assíncrono:** Feedback do progresso em tempo real para o usuário.
  - **Validação Granular:** Checagem linha a linha com base nas regras de negócio (RN01–RN04).
  - **Auditoria Pré-Consolidação:** Geração automática de relatório de inconsistências, mapeando a célula exata e a regra violada antes de salvar no banco.

- 📏 **Motor de Regras (Régua de Cobrança)**
  - **Configuração Visual:** Interface intuitiva para desenhar workflows (`D+5`, `D+15`, `D+30`).
  - **Templates Dinâmicos:** Mensageria personalizável via interpolação de variáveis (ex: `{nome}`, `{valor}`).
  - **Omnichannel Estratégico:** Vinculação de canais de comunicação específicos para cada etapa da escalada de cobrança.

- 🖥️ **Console de Monitoramento**
  - **Observabilidade Integrada:** Terminal web simulado para acompanhamento em tempo real.
  - **Métricas de Infraestrutura:** Status das filas (RabbitMQ) e consumo de memória (Redis).
  - **Métricas de Integração:** Logs dos workers e monitoramento de latência/retorno das APIs parceiras (SendGrid, Twilio).

- 👥 **Gestão de Acesso (RBAC)**
  - **Perfis de Usuário:** Segregação clara entre **Administrador**, **Gestor** e **Operador**.
  - **Segurança:** Proteção de rotas sensíveis e auditoria de ações globais dentro do sistema.

## Qualidade e CI/CD

| Categoria | Ferramenta / Escopo | Meta / Métrica |
| --- | --- | --- |
| **CI/CD** | GitHub Actions (lint, build e testes) | Execução obrigatória a cada Pull Request |
| **Análise Estática** | SonarCloud (Quality Gate na `master`) | Zero bugs críticos, vulnerabilidades ou code smells |
| **Testes Automatizados (Back-end)** | `pytest` (fluxos críticos, cálculo de régua, parsers, CSV) | Cobertura ≥ **80%** |
| **Testes Automatizados (Front-end)** | Testes unitários (componentes críticos de renderização) | Cobertura ≥ **25%** |
| **Disponibilidade Alvo (SLA / Performance)** | Disponibilidade da aplicação e tempo de resposta da API (P95) | SLA de **99%** e API **< 300 ms** |

---

## Documentação e Design

- Documentação arquitetural aprofundada disponível em [`/docs`](./docs).
- Wireframes e protótipos no [Figma do projeto](https://www.figma.com/design/aTgE91sZyzbxTrB8kh5clh/Plataforma-de-Cobran%C3%A7a-Automatizada).

---

<p align="center">
  <sub>© 2026 Plataforma de Cobrança Automatizada. Desenvolvido como Trabalho de Conclusão de Curso — Engenharia de Software, Católica SC.</sub>
</p>
