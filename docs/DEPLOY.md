<div align="center">

# Implantação em produção

**Registro das decisões de deploy para o TCC · complemento ao RFC, marco M6**

<img src="https://img.shields.io/badge/AWS-EC2_+_RDS-59636e?logo=amazonwebservices&logoColor=white" alt="AWS EC2 e RDS" />
<img src="https://img.shields.io/badge/primeiro_deploy-17%2F11%2F2026-1a7f37" alt="Primeiro deploy em 17/11/2026" />

<sub>[README](../README.md) · [RFC](./RFC.md) · [Back-end](../back-end/DOC.md) · [Front-end](../front-end/README.md) · [Deploy](../deploy/README.md) · **Registro do deploy**</sub>

</div>

| Campo | Valor |
|---|---|
| **Autora** | Mariele Vieira da Silva |
| **Ambiente** | Produção (AWS) |
| **Endereço** | <https://cobranca-tcc.duckdns.org> |
| **Primeiro deploy** | 17/11/2026, pelo pipeline de CI/CD (PR #38) |
| **Guia operacional** | [`deploy/README.md`](../deploy/README.md) (passo a passo de provisionamento e operação) |

Este documento registra **como** e **por que** o sistema foi implantado: arquitetura de produção, recursos de nuvem, justificativa da região, pipeline de entrega, controles de segurança, custos e as diferenças em relação ao que a proposta (RFC) previa. O passo a passo técnico fica no guia operacional; aqui o foco são as decisões.

---

## 1. Visão geral

A aplicação roda em uma máquina virtual **Amazon EC2**, com todos os serviços da aplicação em contêineres orquestrados pelo **Docker Compose** (RNF09), e o banco de dados em um **Amazon RDS for PostgreSQL** gerenciado. O front-end e a API são servidos pelo **mesmo domínio**, com HTTPS automático. Cada alteração aprovada na branch `main` é testada, empacotada e publicada pelo **GitHub Actions**, sem acesso manual ao servidor.

Funcionalidades verificadas no ambiente de produção após o primeiro deploy: login e sessão (incluindo renovação do token), dashboard, importação de lotes com acompanhamento do processamento e relatório de erros por linha, troca de senha, logout e novo login.

---

## 2. Arquitetura de produção

```
                   ┌───────────────────────── EC2 (Ubuntu 24.04, t3.small) ─────────────────────────┐
                   │                                                                                 │
 Navegador ─HTTPS─►│  web (Caddy) ──┬─► arquivos do front-end (React, build estático)                │
   porta 443       │                └─► /auth, /lotes, /devedores, ... ─► api (FastAPI, 2 workers)   │
                   │                                                         │                       │
                   │                       worker (Celery) ◄── rabbitmq ◄────┤                       │
                   │                       beat (Celery Beat) ──► rabbitmq   │                       │
                   │                       redis (sessões revogadas, resultados)                     │
                   └─────────────────────────────────────────────────────────┼───────────────────────┘
                                                                             │ TLS, porta 5432
                                                                 RDS PostgreSQL 15 (rede privada)
```

*Figura 1 — Arquitetura de produção. O diagrama C4 de containers está no [RFC, seção 5.1](./RFC.md#51-modelo-c4).*

**Containers em produção** (o RFC, seção 5.1, lista os containers lógicos; aqui está onde cada um roda):

| Container | Imagem | Onde roda | Observação |
|---|---|---|---|
| `web` | `ghcr.io/marielev/cobranca-web` | EC2 | Caddy: HTTPS, arquivos do front-end e proxy reverso da API |
| `api` | `ghcr.io/marielev/cobranca-api` | EC2 | FastAPI com 2 processos; aplica as migrações do banco ao subir |
| `worker` | `cobranca-api` | EC2 | Celery: processamento de lotes e disparos (concorrência 2) |
| `beat` | `cobranca-api` | EC2 | Celery Beat: agenda o ciclo da régua a cada 5 minutos |
| `rabbitmq` | `rabbitmq:3-alpine` | EC2 | Fila de mensagens (sem o painel de gestão, para economizar memória) |
| `redis` | `redis:7-alpine` | EC2 | Persistência em disco (AOF): sessões revogadas sobrevivem a reinícios |
| Banco de dados | — | **RDS** | PostgreSQL 15 gerenciado, sem acesso público |

### 2.1 Decisões de arquitetura

- **Front-end e API no mesmo domínio, sem prefixo.** O Caddy encaminha à API apenas os caminhos das rotas REST (`/auth`, `/lotes`, `/devedores`, `/usuarios`, `/auditoria`, `/regras`, `/jobs`, `/dashboard`, `/health`); todo o resto é o front-end. Motivo: o *refresh token* fica num cookie `httpOnly` restrito ao caminho `/auth`, e um prefixo (como `/api/auth`) faria o navegador deixar de enviá-lo. Como efeito colateral positivo, não há requisições entre origens diferentes (CORS) e o cookie pode usar `SameSite=Lax`.
- **Banco gerenciado (RDS) e fila/cache em contêiner.** O banco guarda o que não pode ser perdido (devedores, regras, histórico, auditoria), então foi para um serviço gerenciado, com backup automático, criptografia e atualizações de segurança feitas pela AWS. RabbitMQ e Redis guardam dados transitórios e rodam na própria EC2: os equivalentes gerenciados (Amazon MQ e ElastiCache) multiplicariam o custo sem benefício proporcional para o volume do projeto.
- **Imagens prontas, servidor sem código-fonte.** O servidor não compila nada: ele só baixa imagens já testadas pelo pipeline. Cada imagem é marcada com o identificador (SHA) do commit, o que permite voltar a uma versão anterior com um único comando.
- **Rotas internas não expostas.** A documentação interativa (`/docs`, `/openapi.json`) e as métricas (`/metrics`) existem na API, mas o proxy não as publica na internet.

---

## 3. Recursos na AWS

| Recurso | Configuração | Motivo |
|---|---|---|
| **EC2** `cobranca` | Ubuntu Server 24.04 LTS, `t3.small` (2 vCPU, 2 GB), disco de 20 GB gp3 criptografado, 2 GB de *swap* | A `t3.micro` (1 GB) não comporta RabbitMQ, Celery e a API juntos |
| Especificação de crédito de CPU | **Padrão** | Sem cobrança extra por uso de CPU acima da linha de base (no modo *Ilimitado* haveria) |
| **Elastic IP** | Associado à EC2 | Endereço fixo mesmo após reinícios; o domínio aponta para ele |
| **RDS** `cobranca-db` | PostgreSQL 15.19, `db.t4g.micro`, 20 GB gp3, Single-AZ, criptografado, sem acesso público | Classe do nível gratuito; mesma versão usada nos testes do CI |
| Backup do RDS | Automático diário, retenção de 1 dia (limite do plano gratuito) + snapshots manuais antes de mudanças arriscadas | — |
| **Security group** `cobranca-ec2` | Entrada: 80 e 443 (web) e 22 (SSH, só com chave) | A porta 80 é usada pelo Let's Encrypt e redireciona para HTTPS |
| **Security group** `cobranca-rds` | Entrada: só a porta 5432, e só a partir do security group da EC2 | O banco não é alcançável pela internet |
| **Domínio** | `cobranca-tcc.duckdns.org` (DuckDNS, gratuito) | O certificado HTTPS exige um nome de domínio |
| **Orçamento** | `tcc-cobranca-mensal`, US$ 16/mês, alertas em 80% (real) e 100% (previsto), sem descontar créditos | Detectar gasto acima do esperado antes que consuma os créditos |

---

## 4. Escolha da região: `us-east-2` (Ohio)

A região natural para usuários no Brasil seria `sa-east-1` (São Paulo). A implantação usou `us-east-2` (Ohio) após comparar três critérios:

| Critério | `sa-east-1` (São Paulo) | `us-east-2` (Ohio) |
|---|---|---|
| **Custo** de EC2 e RDS | Uma das regiões mais caras da AWS | Bem mais barata; os créditos acadêmicos duram mais |
| **Latência** para o Brasil | ~10–30 ms por requisição (estimativa) | ~120–150 ms por requisição (estimativa) |
| **Localização dos dados** | No Brasil | Nos EUA (transferência internacional, LGPD art. 33) |

**Justificativa.** O projeto roda com créditos limitados (válidos até maio de 2027) e precisa ficar no ar até a apresentação; em Ohio, o mesmo crédito sustenta o ambiente por mais tempo. A latência extra é perceptível, mas não compromete o uso de um painel administrativo. Quanto à LGPD, a transferência internacional é admitida com salvaguardas (art. 33), e **o ambiente do TCC usa apenas dados fictícios**, sem dados pessoais reais de devedores.

**Para uso real** (por exemplo, com a Consulth), a recomendação é recriar o ambiente em `sa-east-1`, por latência e para manter os dados no país. Nenhuma parte do código depende da região: basta provisionar os mesmos recursos lá e apontar o domínio.

> **Nota sobre o RNF02 (P95 < 300 ms).** O requisito é medido no tempo de resposta da API. A latência de rede entre o usuário e a região se soma a ele, mas não faz parte da medição do servidor. A evidência do RNF02 vem do teste de carga ([`carga/README.md`](../carga/README.md)), medido no ambiente local com a API configurada como em produção, justamente para não somar a latência de rede ao tempo da API.

---

## 5. Pipeline de entrega contínua (CI/CD)

O fluxo de branches segue o git-flow: `feature/*` → `develop` → *pull request* para `main`. A `main` é protegida: só recebe código por *pull request* e só depois que os quatro *checks* obrigatórios passam.

```
 push / PR ──► Testes e SonarCloud ────────┐
               (pytest, cobertura ≥ 80%,   │
                Quality Gate)              │
           ──► Migrações no PostgreSQL ────┤
               (aplica, compara, desfaz)   ├──► Deploy (só na main, com aprovação manual)
           ──► Build da imagem Docker ─────┤      1. publica as imagens no GHCR (tag = commit)
               (API, front, Caddyfile,     │      2. copia o compose para a EC2 (SSH)
                compose de produção)       │      3. docker compose pull + up --wait
           ──► Front-end ──────────────────┘      4. teste de fumaça: https://DOMINIO/health
               (lint, tipos, testes, build)
```

*Figura 2 — Pipeline de CI/CD (sugestão de print: execução verde na aba Actions, com o job Deploy concluído).*

Pontos de controle:

- **Bloqueio por qualidade (RNF07).** O job de deploy depende dos quatro jobs anteriores (`needs`): se qualquer teste falhar ou o Quality Gate do SonarCloud reprovar, nada é publicado.
- **Aprovação humana.** O deploy usa o ambiente `producao` do GitHub, que exige aprovação manual da autora e só aceita a branch `main`. Cada deploy fica pausado até alguém clicar em "Aprovar e implantar".
- **Segredos isolados.** As credenciais de acesso ao servidor (chave SSH e assinatura do servidor) ficam nos segredos desse ambiente, nunca no repositório.
- **Atualização sem intervenção manual.** O servidor baixa as imagens novas e recria só os contêineres que mudaram; o comando espera todos ficarem saudáveis (`--wait`). As migrações do banco rodam automaticamente quando a API sobe.
- **Verificação final.** O teste de fumaça chama `/health` pelo domínio público, o que confirma HTTPS, proxy, API, banco, Redis e RabbitMQ de uma vez.
- **Deploy nunca interrompido no meio.** Execuções na `main` não se cancelam umas às outras, para não deixar o servidor numa versão parcial.
- **Reversão.** Para voltar a uma versão anterior, basta subir os contêineres com a tag do commit desejado.

---

## 6. Segurança em produção

| Controle | Como foi implementado | Requisito |
|---|---|---|
| HTTPS obrigatório | Certificado Let's Encrypt emitido e renovado automaticamente pelo Caddy; HTTP redireciona para HTTPS; cabeçalho HSTS | RFC 6.1 |
| Cabeçalhos de segurança | `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`; o cabeçalho `Server` é removido | RFC 6.1 |
| Sessão | Cookies `httpOnly`, `Secure` e `SameSite=Lax`; a API se recusa a subir em produção sem `COOKIE_SECURE=true` | RNF04 |
| Criptografia em repouso | Disco da EC2 e banco RDS criptografados pela AWS; além disso, o valor da dívida é cifrado pela aplicação (Fernet) antes de ir ao banco | RNF05 |
| Criptografia em trânsito até o banco | Conexão com o RDS exige TLS (`sslmode=require`); a API se recusa a subir sem isso | RNF05 |
| Isolamento de rede | Banco sem acesso público, alcançável só pela EC2; API, Redis e RabbitMQ sem portas publicadas (só o Caddy fica exposto) | — |
| Segredos | Arquivo `.env` só no servidor (permissão `600`), com cópia em gerenciador de senhas; segredos do pipeline no ambiente `producao` do GitHub | RFC 6.1 |
| Credenciais padrão | O administrador inicial de produção é criado com senha própria (o *seed* recusa a senha de desenvolvimento) e a senha foi trocada após o primeiro acesso | — |
| Acesso ao servidor | SSH apenas por chave (sem senha) | — |
| Auditoria com IP real | O proxy repassa o IP do usuário à API, usado no bloqueio de tentativas de login e no log de auditoria | RN06 / RF11 |
| Envio real desligado | `ENVIO_SIMULADO=true` até o teste dos provedores: nenhuma mensagem real é disparada a partir dos dados fictícios | — |

---

## 7. Custos e operação

- **Financiamento:** créditos da AWS (~US$ 140, válidos até 16/05/2027). Quando os créditos ou o prazo acabam, o acesso aos serviços termina e o ambiente sai do ar.
- **Controle de gastos:** orçamento mensal de US$ 16 com alertas por e-mail; acompanhamento semanal do saldo de créditos.
- **Backup:** snapshot automático diário do RDS e snapshot manual antes de migrações ou da apresentação.
- **Operação do dia a dia:** estado dos serviços, logs e uso de memória são consultados por SSH com comandos do Docker Compose (detalhados no guia operacional).
- **Encerramento:** ao fim do TCC, a EC2 e o RDS são apagados e o Elastic IP é liberado (ele é cobrado mesmo sem uso).

---

## 8. Rastreabilidade com o RFC

| Requisito / marco | Situação em produção |
|---|---|
| **RNF04** — JWT curto + refresh token | Atendido (cookies `Secure`/`httpOnly` sob HTTPS) |
| **RNF05** — criptografia em repouso | Atendido (RDS e disco criptografados + valor da dívida cifrado pela aplicação) |
| **RNF07** — CI/CD bloqueia deploy sem testes/Quality Gate | Atendido (deploy depende dos quatro jobs e da `main` protegida) |
| **RNF09** — tudo em contêineres com Docker Compose | Atendido (seis serviços no Compose; o banco é gerenciado, ver desvios) |
| **RNF08** — métricas Prometheus | A API expõe `/metrics`; o Prometheus/Grafana roda no ambiente local, não em produção (ver limitações) |
| **RNF01 / RNF02** — 100 usuários simultâneos, P95 < 300 ms | Atendido no ambiente local em 23/11/2026: 100 usuários, P95 de 99 ms e 0% de falhas (k6, [`carga/`](../carga/README.md#resultados)) |
| **M6** — Deploy com Docker e HTTPS | Concluído em 17/11/2026 |

### 8.1 Diferenças em relação à proposta

| O RFC previa | O que foi feito | Por quê |
|---|---|---|
| "Deploy em VPS com Docker" (M6) | EC2 (máquina virtual da AWS) com Docker + **RDS** para o banco | Créditos acadêmicos da AWS; banco gerenciado traz backup e criptografia sem esforço operacional |
| "TLS via Nginx reverse proxy" (6.1) | **Caddy** como proxy reverso | Emite e renova o certificado HTTPS automaticamente, com configuração bem menor; mesma função do Nginx |
| PostgreSQL em contêiner (5.1) | PostgreSQL **gerenciado** (RDS); em desenvolvimento e no CI continua em contêiner | Dados persistentes num serviço com backup e alta durabilidade |
| Hospedagem no Brasil (implícito) | Região `us-east-2` (Ohio) | Custo; ver seção 4 |

---

## 9. Limitações conhecidas

- **Instância única.** Uma só EC2 e banco Single-AZ: uma falha da máquina ou da zona tira o sistema do ar até a recuperação. Adequado para o TCC; uso real pediria múltiplas zonas.
- **Observabilidade fora da produção.** Prometheus e Grafana não foram implantados na AWS para não disputar a memória da `t3.small`; as métricas são demonstradas no ambiente local.
- **CPU com créditos.** No modo Padrão, a `t3.small` fica mais lenta quando esgota os créditos de CPU; testes de carga longos contra produção podem medir essa limitação, e não a aplicação.
- **Disparos reais pendentes.** O envio por SendGrid/Twilio está desligado até a validação dos provedores.
- **Domínio gratuito.** O DuckDNS atende ao TCC; uso real pediria domínio próprio.

---

## 10. Evidências para o documento do TCC

Capturas sugeridas (não incluem segredos; antes de capturar, confira que nenhuma tela mostra senhas, chaves ou o conteúdo do `.env`):

| # | Captura | Onde obter |
|---|---|---|
| 1 | Site no ar com o cadeado do HTTPS e a tela de login | Navegador em https://cobranca-tcc.duckdns.org (clique no cadeado para mostrar o certificado Let's Encrypt) |
| 2 | Dashboard em produção | Após o login, com a massa de dados fictícia |
| 3 | Pipeline verde com o job Deploy | GitHub → Actions → execução do merge na `main` |
| 4 | Aprovação manual do deploy | Mesma execução, etapa "Revisar implantações" do ambiente `producao` |
| 5 | Regras de proteção da `main` | GitHub → Settings → Rules → "Proteção da Main" (os quatro checks) |
| 6 | Instância EC2 em execução | Console AWS → EC2 → Instâncias (tipo, região, estado) |
| 7 | Banco RDS disponível, sem acesso público | Console AWS → RDS → `cobranca-db` → Conectividade e segurança |
| 8 | Security group do RDS liberando só a EC2 | Console AWS → EC2 → Security groups → `cobranca-rds` → Regras de entrada |
| 9 | Serviços saudáveis | Terminal SSH na EC2: `docker compose ps` |
| 10 | Imagens publicadas | GitHub → perfil → Packages (`cobranca-api`, `cobranca-web`) |
| 11 | Orçamento configurado | Console AWS → Billing → Budgets |
