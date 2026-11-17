# Teste de carga (RNF01, RNF02 e RNF03)

Evidência dos requisitos não funcionais de desempenho do [RFC](../docs/RFC.md#24-requisitos-não-funcionais):

| Requisito | O que o RFC pede | Como é verificado |
|---|---|---|
| **RNF01** | Ao menos 100 usuários simultâneos sem degradação | 100 usuários virtuais navegando ao mesmo tempo por 3 min; aprovado se < 1% das requisições falharem |
| **RNF02** | Rotas da API < 300 ms no P95 | Aprovado se o percentil 95 do tempo de resposta for < 300 ms |
| **RNF03** | Arquivos de até 50.000 registros | Importar um lote de 50.000 devedores e registrar o tempo de processamento |

O RNF01 e o RNF02 são critérios automáticos (*thresholds*) do script: o próprio k6 diz se passou (✓) ou não (✗).

| Arquivo | Para quê |
|---|---|
| `rnf01-rnf02.js` | Script do [k6](https://grafana.com/docs/k6/): 100 usuários usando o painel (dashboard, devedores com filtros e busca, régua, jobs, lotes) |
| `gerar_massa.py` | Gera um CSV de devedores fictícios (CPFs válidos, e-mails `@example.com`) |
| `docker-compose.carga.yml` | Sobe a API local como em produção (2 processos, sem `--reload`) |
| `resultados/` | Onde o k6 grava o resumo de cada execução (`.txt` e `.json`; fora do git) |

O k6 roda pela imagem Docker oficial: não precisa instalar nada.

---

## Passo a passo (ambiente local, evidência oficial)

Comandos em PowerShell, a partir da raiz do repositório.

### 1. Subir o back-end como em produção

```powershell
cd back-end
docker compose -f docker-compose.yml -f ../carga/docker-compose.carga.yml up -d
docker compose ps        # api, worker, beat, postgres, redis, rabbitmq "healthy"/"running"
docker exec -it cobranca_api python -m app.seed   # só se o admin ainda não existir
cd ..
```

> Por que não o `docker compose up -d` de sempre? Em desenvolvimento a API roda com `--reload` e um processo só; medir assim subestimaria o sistema. O arquivo extra deixa a API igual à de produção.

### 2. Gerar e importar a massa de dados

```powershell
python carga/gerar_massa.py                      # 5.000 devedores -> carga/massa-5000.csv
```

Importe `carga/massa-5000.csv` pela tela **Importar lote** (`npm run dev` no `front-end`, <http://localhost:8443>) e espere o lote terminar (5.000 novos, 0 rejeitados). Com a base vazia, as consultas ficam artificialmente rápidas. Com milhares de devedores, o teste mede o que um usuário real enfrentaria.

Opcional: ative uma ou duas regras na Régua e use "Executar agora", para o Dashboard e o Monitoramento terem jobs e comunicações.

### 3. Rodar o teste

```powershell
cd carga
docker run --rm -v "${PWD}:/scripts" -w /scripts -e EMAIL=admin@consulth.com.br -e SENHA=admin123 grafana/k6:1.0.0 run rnf01-rnf02.js
cd ..
```

Dura cerca de 4 minutos (30 s subindo até 100 usuários, 3 min no patamar, 15 s descendo). Ajustes opcionais: `-e VUS=150` (mais usuários) e `-e DURACAO=5m` (patamar mais longo; no máximo 12 min, porque a sessão de acesso vale 15 min).

### 4. Ler o resultado

No fim, o k6 mostra o resumo. O que importa:

```text
  █ THRESHOLDS

    checks
    ✓ 'rate>0.99' rate=100.00%

    http_req_duration{tipo:api}
    ✓ 'p(95)<300' p(95)=XX.XXms          ← RNF02

    http_req_failed{tipo:api}
    ✓ 'rate<0.01' rate=0.00%             ← RNF01 (sem degradação com 100 usuários)
```

- **✓ em todos os limites:** requisitos atendidos. O comando termina com código 0.
- **✗ em algum:** o k6 termina com código 99. Veja a seção "Se reprovar".
- `http_reqs` mostra o total de requisições e a taxa por segundo; `vus_max` confirma os 100 usuários.
- O resumo também fica salvo em `carga/resultados/rnf01-rnf02-local-<data>.txt` e `.json`.

### 5. RNF03: lote de 50.000 registros

```powershell
python carga/gerar_massa.py --quantidade 50000   # carga/massa-50000.csv (~5 MB)
```

Importe pela tela **Importar lote** e, ao terminar, abra o **Relatório de validação**: ele mostra "Enviado em ..." e "processado em ...". A diferença é o tempo de processamento, e o total deve ser 50.000 novos e 0 rejeitados. Faça a captura dessa tela.

> Importar os 50.000 **depois** do teste de carga, ou em uma base separada: com 55.000 devedores, as consultas do passo 3 ficam mais pesadas que o cenário planejado. Também é uma medição válida, mas registre qual foi o tamanho da base.

---

## Evidências para o TCC

1. Captura do resumo do k6 com os limites aprovados (✓), mais o arquivo `.txt` de `carga/resultados/`.
2. Ambiente da medição: máquina (processador e memória), tamanho da base (ex.: 5.000 devedores) e API com 2 processos.
3. Opcional, gráfico no Grafana durante o teste. Suba o monitoramento junto:

   ```powershell
   cd back-end
   docker compose -f docker-compose.yml -f ../carga/docker-compose.carga.yml -f docker-compose.monitoring.yml up -d
   ```

   No Grafana (<http://localhost:3000>), em *Explore*, use a consulta abaixo (P95 por minuto, em segundos):

   ```promql
   histogram_quantile(0.95, sum by (le) (rate(cobranca_http_request_duration_seconds_bucket[1m])))
   ```

   Com 2 processos, cada coleta do Prometheus lê as métricas de um processo só. O gráfico é uma amostra; o número oficial é o do k6.
4. RNF03: captura do Relatório de validação do lote de 50.000.

---

## Contra a produção (opcional, com cuidado)

O resultado em produção **não substitui** o local para o RNF02. O k6 mede do seu computador, então o tempo inclui a ida e volta até Ohio (~120–150 ms) e o TLS, que não são tempo da API. Se quiser rodar mesmo assim, por exemplo para mostrar que a infraestrutura aguenta 100 usuários (RNF01):

- Só depois que o filtro por canal (RF05) estiver em produção. Antes disso, a rota com `canal=` devolve 422 e conta como falha.
- Use um patamar curto (`-e DURACAO=1m`): a `t3.small` no modo de crédito Padrão fica lenta se gastar os créditos de CPU.
- Não digite a senha no comando (ela ficaria no histórico do PowerShell):

  ```powershell
  $senha = Read-Host "Senha" -AsSecureString
  $env:SENHA = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($senha))
  cd carga
  docker run --rm -v "${PWD}:/scripts" -w /scripts -e BASE_URL=https://cobranca-tcc.duckdns.org -e EMAIL=seu-email -e SENHA -e DURACAO=1m grafana/k6:1.0.0 run rnf01-rnf02.js
  Remove-Item Env:SENHA
  ```

  (`-e SENHA` sem valor repassa a variável do PowerShell para o contêiner.)

---

## Se reprovar

- **P95 acima de 300 ms:** descubra qual rota pesa mais. O resumo do k6 mostra o conjunto; por rota, use o monitoramento (item 3 das evidências) com a consulta `histogram_quantile(0.95, sum by (le, rota) (rate(cobranca_http_request_duration_seconds_bucket[1m])))`. Suspeitos naturais: `GET /dashboard` (agrega a base toda) e a busca de devedores. Confira também se a máquina não estava ocupada com outra coisa durante o teste.
- **Erros acima de 1%:** veja os logs da API (`docker compose logs --tail=200 api` na pasta `back-end`). Erros 401 no meio do teste indicam sessão expirada (patamar longo demais); 5xx indicam problema real.
- **"Login falhou":** confira EMAIL/SENHA e se a API responde em <http://localhost:8000/health>.
