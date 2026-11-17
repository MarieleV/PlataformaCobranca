# Deploy na AWS (EC2 + RDS PostgreSQL)

Arquitetura de produção:

```
                    ┌──────────────────── EC2 (Ubuntu 24.04, t3.small) ─────────────────────┐
 navegador ──HTTPS──┤ web (Caddy) ── front (dist/) + proxy das rotas da API ──> api (FastAPI) │
   :443             │                                                    worker / beat (Celery)│
                    │                                                    redis · rabbitmq      │
                    └──────────────────────────────────────────┬─────────────────────────────┘
                                                               │ TLS (sslmode=require), porta 5432
                                                     RDS PostgreSQL 15 (sem acesso público)
```

- **Front e API no mesmo domínio**, sem prefixo: o Caddy manda `/auth`, `/lotes`, `/devedores`, `/usuarios`, `/auditoria`, `/regras`, `/jobs`, `/dashboard` e `/health` para a API e o resto para o front. Assim o cookie de refresh (`path=/auth`) funciona, `COOKIE_SAMESITE=lax` basta e não há CORS entre origens. `/docs`, `/openapi.json` e `/metrics` **não** ficam públicos.
- **HTTPS automático**: o Caddy obtém e renova o certificado do Let's Encrypt para o `DOMINIO`.
- **Redis e RabbitMQ** rodam em container na própria EC2 (ElastiCache/Amazon MQ custariam bem mais; para o TCC não compensa).
- **Imagens** são construídas pelo CI e publicadas no GitHub Container Registry (`ghcr.io/marielev/cobranca-api` e `cobranca-web`), com a tag do commit e `latest`. A EC2 só baixa e sobe.

Arquivos desta pasta:

| Arquivo | Para quê |
|---|---|
| `docker-compose.prod.yml` | Serviços de produção (o CI copia para `~/cobranca/docker-compose.yml` na EC2) |
| `.env.example` | Modelo do `~/cobranca/.env` da EC2 (segredos; nunca versionar) |
| `preparar-ec2.sh` | Instala Docker + Compose e cria swap na EC2 (roda uma vez) |

> **Custos.** Contas novas da AWS têm créditos/Free Tier; confira no console se a instância e o banco aparecem como *Free tier eligible*. Crie um **alerta de orçamento** (Billing → Budgets → *Zero spend budget* ou US$ 5) **antes** de criar os recursos. Lembre que o RDS e o Elastic IP cobram mesmo com a EC2 parada.

---

## 0. Antes de começar

1. **Conta AWS** com MFA no usuário root. Para o dia a dia, use um usuário IAM com MFA (não o root).
2. **Região**: `us-east-2` (Ohio). Use a mesma região para tudo (EC2, RDS, Elastic IP).
   - **Por quê:** EC2 e RDS custam bem menos em Ohio do que em São Paulo (`sa-east-1`, uma das regiões mais caras da AWS), o que faz os créditos do TCC durarem mais.
   - **O que se perde:** latência maior para usuários no Brasil (algo como 120–150 ms por requisição, contra ~10–30 ms em São Paulo) e os dados dos devedores ficam fora do país. A LGPD permite transferência internacional com salvaguardas (art. 33). Para o TCC usamos só **dados fictícios**; em produção real com a Consulth, o recomendado é migrar para `sa-east-1`. Basta recriar os recursos lá, porque nada no código depende da região.
3. **Domínio**. Precisa de um nome apontando para a EC2 (o Let's Encrypt não emite para o IP padrão da AWS). Opções:
   - Grátis: [DuckDNS](https://www.duckdns.org) → crie, por exemplo, `cobranca-tcc.duckdns.org` (o IP você preenche no passo 3).
   - Domínio próprio (Registro.br, Route 53…): um registro **A** apontando para o Elastic IP.

## 1. Rede (Security Groups)

Console **EC2 → Security Groups → Create**:

- **`cobranca-ec2`** (entrada):
  - HTTP 80 — `0.0.0.0/0` (o Let's Encrypt valida por aqui; o Caddy redireciona para HTTPS)
  - HTTPS 443 (TCP) — `0.0.0.0/0`
  - SSH 22 — `0.0.0.0/0` *(o CI do GitHub não tem IP fixo; a proteção é a chave SSH, sem senha)*
- **`cobranca-rds`** (entrada):
  - PostgreSQL 5432 — origem: **o security group `cobranca-ec2`** (não um IP)

## 2. Banco: RDS PostgreSQL

Console **RDS → Create database**:

| Campo | Valor |
|---|---|
| Método | Standard create |
| Engine | PostgreSQL **15** (mesma versão do CI) |
| Template | Free tier (ou Dev/Test) |
| Identificador | `cobranca-db` |
| Usuário master | `cobranca_app` · senha forte (sem `@ : / ? #` para não precisar codificar na URL) |
| Classe | `db.t4g.micro` |
| Storage | gp3, 20 GB, autoscaling desligado |
| Conectividade | VPC padrão · **Public access: No** · security group `cobranca-rds` (remova o `default`) |
| Additional configuration | Initial database name: `cobranca_db` · backups automáticos 7 dias · encryption ligada |

Anote o **Endpoint** (ex.: `cobranca-db.xxxx.us-east-2.rds.amazonaws.com`). O PostgreSQL 15 do RDS já exige TLS; a API também recusa subir sem `?sslmode=require`.

## 3. Servidor: EC2

Console **EC2 → Launch instance**:

| Campo | Valor |
|---|---|
| Nome | `cobranca` |
| AMI | **Ubuntu Server 24.04 LTS** (x86_64) |
| Tipo | **t3.small** (2 GB; a t3.micro, com 1 GB, não aguenta RabbitMQ + Celery + API) |
| Key pair | Create new → `cobranca-ec2`, tipo ED25519, formato `.pem` → **guarde o arquivo** |
| Rede | VPC padrão · Auto-assign public IP: Enable · security group `cobranca-ec2` |
| Storage | 20 GB gp3 |
| Advanced → User data | (opcional) cole o conteúdo de `preparar-ec2.sh` |

Depois:

1. **Elastic IP** (EC2 → Elastic IPs → Allocate → Associate à instância `cobranca`). Assim o IP não muda quando a instância reinicia.
2. Aponte o domínio para o Elastic IP (no DuckDNS: cole o IP no campo *current ip* e *update ip*).
3. Conecte (PowerShell, na pasta onde está o `.pem`):

   ```powershell
   icacls .\cobranca-ec2.pem /inheritance:r /grant:r "$($env:USERNAME):(R)"
   ssh -i .\cobranca-ec2.pem ubuntu@SEU_ELASTIC_IP
   ```

4. Se não usou o *User data*, rode a preparação (do PowerShell, na raiz do repositório):

   ```powershell
   scp -i .\cobranca-ec2.pem deploy\preparar-ec2.sh ubuntu@SEU_ELASTIC_IP:~
   ssh -i .\cobranca-ec2.pem ubuntu@SEU_ELASTIC_IP "sudo bash preparar-ec2.sh"
   ```

   Saia e entre de novo no SSH e confira: `docker compose version`.

## 4. Segredos na EC2 (`~/cobranca/.env`)

No seu PC, gere os valores (no venv do back-end):

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"                         # JWT_SECRET
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"  # ENCRYPTION_KEY
python -c "import secrets; print(secrets.token_urlsafe(24))"                         # RABBITMQ_PASSWORD e ADMIN_SENHA_INICIAL
```

> A **ENCRYPTION_KEY** cifra o valor das dívidas no banco: perdeu, perdeu os dados. Guarde uma cópia num gerenciador de senhas. Não reaproveite as chaves do `.env` de desenvolvimento.

Copie o modelo e edite **na EC2**:

```powershell
scp -i .\cobranca-ec2.pem deploy\.env.example ubuntu@SEU_ELASTIC_IP:cobranca/.env
ssh -i .\cobranca-ec2.pem ubuntu@SEU_ELASTIC_IP
```

```bash
cd ~/cobranca
chmod 600 .env
nano .env   # DOMINIO, DATABASE_URL (endpoint + senha do RDS), CORS_ORIGINS=https://DOMINIO, segredos, ADMIN_SENHA_INICIAL
```

A `ADMIN_SENHA_INICIAL` precisa de 8+ caracteres com letra e número (e não pode ser `admin123`, o seed recusa em produção).

## 5. GitHub: ambiente `producao`, segredos e pacotes

1. **Settings → Environments → `producao`** (já é usado pelo job Deploy). Recomendado: *Required reviewers* = você (cada deploy pede um clique de aprovação) e *Deployment branches* = só `main`.
2. Em **`producao` → Environment secrets**:

   | Segredo | Valor |
   |---|---|
   | `EC2_HOST` | o Elastic IP (ou o domínio) |
   | `EC2_USUARIO` | `ubuntu` |
   | `EC2_CHAVE_SSH` | o conteúdo **inteiro** do `cobranca-ec2.pem` (incluindo as linhas `-----BEGIN/END`) |
   | `EC2_KNOWN_HOSTS` | a saída de `ssh-keyscan -t ed25519 SEU_ELASTIC_IP` (rode no PowerShell) |

   E em **Environment variables**: `DOMINIO` = `cobranca-tcc.duckdns.org` (o seu).

   > Use o mesmo valor no `EC2_HOST` e no `ssh-keyscan` (IP com IP, domínio com domínio), senão a verificação da chave do servidor falha.

3. **Pacotes do GHCR**: o primeiro deploy cria `cobranca-api` e `cobranca-web` como **privados**. Depois dele, em github.com → seu perfil → **Packages** → cada pacote → *Package settings* → *Change visibility* → **Public** (o repositório já é público e as imagens não têm segredos). Sem isso a EC2 não consegue baixar.
   - Se preferir mantê-los privados: na EC2, `docker login ghcr.io -u MarieleV` com um *Personal access token (classic)* só com `read:packages`.

## 6. Primeiro deploy

1. Faça o merge na `main` (PR `develop` → `main`). O CI roda os quatro checks e, se passarem, o job **Deploy**:
   1. constrói e publica as duas imagens no GHCR;
   2. copia o `docker-compose.prod.yml` para a EC2;
   3. `docker compose pull` + `up -d --wait` (a API aplica as migrações no RDS ao subir);
   4. testa `https://DOMINIO/health`.
2. **No primeiro deploy** o passo 3 falha porque os pacotes ainda são privados: torne-os públicos (passo 5.3) e clique em **Re-run failed jobs**.
3. Crie o administrador (uma vez):

   ```bash
   cd ~/cobranca
   docker compose exec api python -m app.seed
   ```

4. Abra `https://SEU_DOMINIO`, entre com `ADMIN_EMAIL` / `ADMIN_SENHA_INICIAL` e **troque a senha** em *Minha conta*.

## Operação

```bash
cd ~/cobranca
docker compose ps                         # estado dos serviços
docker compose logs -f --tail=100 api     # logs (api, worker, beat, web…)
docker compose restart worker             # reiniciar um serviço
IMAGE_TAG=<sha-antigo> docker compose up -d   # voltar para a versão de um commit anterior
docker stats --no-stream                  # memória/CPU por container
```

- **Atualizar segredos**: edite `~/cobranca/.env` e rode `docker compose up -d` (recria só o que mudou).
- **Envio real**: só depois do teste dos provedores (`ENVIO_SIMULADO=false` + chaves do SendGrid/Twilio no `.env`). Teste: `docker compose exec api python -m app.testar_provedores email voce@exemplo.com`.
- **Backup**: o RDS faz backup diário automático (7 dias). Antes de algo arriscado, tire um snapshot manual (RDS → Actions → Take snapshot).
- **Memória**: se `docker stats` mostrar a máquina no limite, reduza `--workers` da API ou `--concurrency` do worker no `docker-compose.prod.yml`, ou suba para `t3.medium`.
- **Desligar para não gastar**: pare a EC2 e o RDS (o RDS religa sozinho após 7 dias). Para encerrar de vez: apague a EC2, o RDS (com snapshot final, se quiser), e **libere o Elastic IP**.

## Testar a imagem do front localmente (opcional)

Com o back-end de desenvolvimento rodando (`docker compose up -d` em `back-end/`):

```powershell
docker build -t cobranca-web:teste front-end
docker run --rm --name web_teste --network back-end_default -e DOMINIO=localhost -p 8444:443 cobranca-web:teste
```

Abra `https://localhost:8444` (o navegador avisa do certificado local; aceite). Login, refresh e upload passam pelo Caddy exatamente como em produção.
