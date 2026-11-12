# Roteiro de testes do front-end (teste final da integração)

Testes manuais no navegador, etapa por etapa. Marque `[x]` conforme for passando.

## Preparação

```powershell
cd back-end; docker compose up -d          # se o RabbitMQ demorar, rode de novo
docker exec -it cobranca_api python -m app.seed
cd ..\front-end; npm install; npm run dev  # http://localhost:8443 (use localhost, não 127.0.0.1)
```

- Login de desenvolvimento: `admin@consulth.com.br` / `admin123`.
- Para testar perfis, crie um **gestor** e um **operador** (tela Usuários, etapa 7, ou em `http://localhost:8000/docs`).
- Envio simulado: e-mail começando com `bounce` = bounce; `falha...` = falha temporária (reenvio a cada 30 min); telefone terminando em `0000` = bounce, em `9999` = falha.
- Os disparos automáticos só acontecem **seg–sex, 8h–19h** (Brasília). Fora disso, os jobs ficam aguardando.

Arquivos de exemplo usados abaixo (gere outros com a "planilha modelo" da tela de importação):

| Arquivo | Conteúdo |
|---|---|
| `devedores-demo.csv` | 11 válidos (9 com 3 dias de atraso, 2 com 10) + 1 linha inválida |
| `teste-com-rejeicoes.csv` | 37 linhas: 31 novos, 1 atualiza a Ana Souza, 5 rejeitados |
| `teste-sem-coluna-email.csv` | sem a coluna `email` (erro estrutural) |
| `teste-formato-invalido.txt` / `teste-vazio.csv` | recusados antes do envio |

## 1. Login e sessão

- [ ] Login com o admin mostra nome, iniciais e "ADMINISTRADOR" na sidebar.
- [ ] Senha errada: "E-mail ou senha incorretos". E-mail malformado: "Informe um e-mail válido".
- [ ] 5 erros seguidos + 1: mensagem de muitas tentativas (429).
- [ ] F5 mantém o login.
- [ ] Apagar só o cookie `access_token` (DevTools > Application > Cookies) e dar F5: continua logado (refresh automático).
- [ ] "Encerrar sessão" volta ao login; F5 depois disso continua no login.
- [ ] Com a API parada (`docker compose stop api`): aviso de que não foi possível conectar.
- [ ] Operador não vê "Usuários" no menu.

## 2. Dashboard

- [ ] KPIs batem com a base (devedores, disparos de hoje, taxa de entrega × meta de 95%, falhas).
- [ ] Taxas sem base aparecem como "—".
- [ ] Período 7/15/30 dias muda o gráfico e as datas.
- [ ] Gráfico empilhado (sucesso/falhas/aguardando); sem disparos, mostra "Nenhum disparo...".
- [ ] Distribuição por canal e conversão.
- [ ] Tabelas de últimos lotes e jobs; clicar num lote abre o Relatório daquele lote.
- [ ] Atalhos "Importar lote" e "Monitoramento".
- [ ] Atualiza sozinho a cada minuto ("Atualizado às...").
- [ ] `docker stop cobranca_redis`: selo vermelho "Instável: Redis" em até 1 min (depois `docker start cobranca_redis`).

## 3. Importar lote e Relatório de validação

- [ ] `teste-formato-invalido.txt` e `teste-vazio.csv` são recusados antes de enviar.
- [ ] `teste-com-rejeicoes.csv`: barra de progresso avança; resultado 31 novos, 1 atualizado, 5 rejeitados.
- [ ] "Ver linhas rejeitadas" abre o relatório do lote; a linha 7 tem 2 problemas (Nome e Vencimento).
- [ ] Filtro por campo e paginação dos problemas.
- [ ] "Exportar CSV de erros" baixa o arquivo e ele abre no Excel com acentos.
- [ ] Seletor de lote troca o relatório.
- [ ] `teste-sem-coluna-email.csv`: card vermelho "Colunas obrigatórias ausentes: email".
- [ ] Planilha modelo baixa e, importada, gera 2 novos e 0 rejeitados.
- [ ] `docker stop cobranca_rabbitmq`: upload mostra "Fila de processamento indisponível" (depois `docker start cobranca_rabbitmq`).

## 4. Devedores

- [ ] Lista com total, ordenada do vencimento mais antigo; CPF/CNPJ mascarado.
- [ ] Busca por nome, por CPF só com dígitos e por CPF com pontuação (ex.: `104.332`). Com 1 caractere aparece a dica "pelo menos 2".
- [ ] Filtros de status e de atraso (combinados), "Limpar filtros" e paginação (com mais de 50 devedores).
- [ ] Coluna "Contatos" risca os canais sem contato cadastrado.
- [ ] Clicar numa linha abre o painel: CPF completo, valor em R$, vencimento com D+N, contatos, "Ver lote de origem".
- [ ] Histórico mostra as comunicações (enviado / bounce / falha com o motivo e as tentativas).
- [ ] Trocar status para Negociando e de volta para Ativo; a lista atualiza.
- [ ] Marcar como Quitado pede confirmação; depois disso, o painel diz que não pode ser reaberto.
- [ ] **Operador**: não vê "Quitado" nas opções e não vê a zona de exclusão. **Gestor**: vê "Quitado", mas não a exclusão.
- [ ] **Admin**: "Excluir devedor" só habilita digitando EXCLUIR; após excluir, o painel fecha e aparece o aviso verde.
- [ ] Esc fecha o modal e depois o painel.
