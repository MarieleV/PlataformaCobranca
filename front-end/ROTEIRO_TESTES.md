# Roteiro de testes do front-end (teste final da integração)

Testes manuais no navegador, etapa por etapa. Marque `[x]` conforme for passando.

## Preparação

```powershell
cd back-end; docker compose up -d          # se o RabbitMQ demorar, rode de novo
docker exec -it cobranca_api python -m app.seed
cd ..\front-end; npm install; npm run dev  # http://localhost:8443 (use localhost, não 127.0.0.1)
```

- Login de desenvolvimento: `admin@consulth.com.br` / `admin123`.
- Para testar perfis, crie um **gestor** e um **operador** pela tela **Usuários** (seção 7) e use uma janela anônima para logar com eles sem derrubar a sessão do admin.
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
- [ ] Tabelas de últimos lotes e jobs; clicar num lote abre o Relatório daquele lote; clicar num job abre o painel do job no Monitoramento.
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

## 5. Régua de cobrança

Visualização (todos os perfis):
- [ ] Selo de status: "Régua ativa · N de M regras ativas" (verde) ou "Régua inativa..." (âmbar) quando nenhuma regra está ativa.
- [ ] Cards com canal, D+N, horário e início do template; filtro Todos / E-mail / SMS / WhatsApp.
- [ ] Clicar num card mostra o detalhe (template com as variáveis destacadas) e os **Elegíveis hoje** com o total e a explicação do critério.
- [ ] Com a massa de demonstração, a regra "Lembrete 3 dias (e-mail)" mostra os devedores com 3 dias de atraso que ainda não receberam com sucesso hoje (ex.: o bounce e a falha).
- [ ] **Operador**: não vê "Nova regra", o switch vira o texto Ativa/Inativa e não há botões Editar/Executar/Excluir; aparece a nota de que só gestor/admin gerenciam.

Criar e editar (gestor/admin):
- [ ] "Nova regra" abre o editor com um template inicial; a pré-visualização mostra a mensagem com dados de exemplo (Maria, R$ 1.234,56...).
- [ ] Clicar numa variável insere no ponto do cursor.
- [ ] Contador de caracteres por canal (SMS 480, WhatsApp 1024, e-mail 5000); no SMS acima de 160 mostra o número de partes.
- [ ] Variável inexistente (ex.: `{link}`) aparece como erro no campo e na pré-visualização.
- [ ] Ao clicar em "Criar regra" com nome de 1 letra, D+0 ou horário 07:00/20:00, aparecem os erros por campo e nada é enviado.
- [ ] Regra criada aparece **inativa** com o aviso verde "criada (inativa)".
- [ ] Editar só o nome salva e mantém o resto; editar uma regra ativa mostra o aviso "as alterações valem a partir do próximo ciclo".

Ativar, executar e excluir (gestor/admin):
- [ ] Ativar pelo switch: aviso "ativada: entra no próximo ciclo" e o selo de status atualiza.
- [ ] Criar outra regra de **e-mail D+3** e tentar ativar: erro "Já existe uma regra ativa para email com 3 dias de atraso ('Lembrete 3 dias (e-mail)'). Desative-a antes."
- [ ] Desativar e ativar de volta.
- [ ] "Executar agora" fica desabilitado em regra inativa.
- [ ] Executar a regra demo **hoje** de novo: "A regra já foi executada para DD/MM/AAAA".
- [ ] O seletor de data só aceita de hoje até 7 dias atrás; executar um dia anterior válido mostra "Execução de ... solicitada" e o job aparece no Dashboard/Monitoramento.
- [ ] Excluir uma regra nova (sem disparos): some da lista.
- [ ] Excluir a regra demo (já disparou): mensagem de histórico e o botão vira "Desativar regra".

## 6. Monitoramento

Serviços e janela:
- [ ] Quatro cards: Banco de dados, Redis, RabbitMQ (Operacional) e Janela de disparo.
- [ ] Janela **Aberta** em dia útil das 8h às 19h55, com "Próximo ciclo às HH:MM" (múltiplo de 5 min); fora disso **Fechada** com "Abre hoje/amanhã/seg. às 08:00".
- [ ] `docker stop cobranca_redis`: em até 30 s o card do Redis fica vermelho "Fora do ar" (depois `docker start cobranca_redis`).
- [ ] Com a API parada, os cards de serviço mostram "API sem resposta".

Jobs:
- [ ] Lista com total, regra, canal, dia de referência, status, barra de progresso (verde = sucesso, vermelho = falha), sucesso/falhas/pendentes e início.
- [ ] Filtros por status e por regra; "Atualizar"; paginação com mais de 20 jobs.
- [ ] Com job em andamento, aparece "Há jobs em andamento · atualiza sozinho a cada 15 s" e os números mudam sem recarregar.
- [ ] Sem jobs: "Nenhum job executado ainda...".

Painel do job (clique numa linha):
- [ ] Números (alvos, sucesso, falhas, pendentes), progresso, início e fim ("em andamento" enquanto executa).
- [ ] Comunicações com filtro Todas / Pendentes / Enviadas / Falhas / Bounces e o total de cada.
- [ ] No job da massa demo: 7 enviadas, o bounce do Hugo Alves com `[SIMULADO_BOUNCE]`, e a Iara Costa como "Falha · vai reenviar" com "reenvio às ..." e "N de 4" tentativas (após a 4ª, vira "Falha definitiva").
- [ ] Quando todas se resolvem, o job vira **Concluído** (ou **Falhou**, se nenhuma deu certo) e o painel para de atualizar.
- [ ] Esc ou clique fora fecha o painel.

## 7. Usuários, Minha conta e Auditoria

Administrador:
- [ ] Cards com a descrição dos 3 perfis; lista com nome, e-mail, perfil, situação e criado em; a própria linha mostra "você" e só tem "Editar".
- [ ] Busca por nome ou e-mail (mín. 2 caracteres), filtros de perfil e situação.
- [ ] "Novo usuário": "Gerar senha" preenche e mostra uma senha válida; senha `abcdefgh` mostra "ao menos uma letra e um número"; e-mail já usado mostra "E-mail já cadastrado".
- [ ] Criar um **gestor** e um **operador**: aviso verde e aparecem na lista.
- [ ] Editar nome/e-mail de outro usuário e trocar o perfil (aviso de que vale na próxima ação dele).
- [ ] Editar a si mesmo: o perfil aparece travado ("você não pode alterar o próprio perfil"); mudar o nome atualiza a sidebar.
- [ ] Redefinir senha de outro usuário: aviso de sessões encerradas; ele precisa logar de novo com a nova senha.
- [ ] Desativar: confirmação; o usuário desativado não consegue logar ("Usuário inativo..."), e a linha fica esmaecida com "Reativar".
- [ ] Excluir um usuário sem lotes/regras: some da lista. Excluir alguém que já importou lote ou criou regra: mensagem de vínculos e botão "Desativar em vez disso".

Gestor (logado como o gestor criado):
- [ ] Vê só operadores, sem cards de perfis e sem filtro de perfil; o botão é "Novo operador" e o formulário não tem seleção de perfil.
- [ ] Edita, redefine senha, desativa e reativa operadores; não há botão "Excluir".
- [ ] Não vê "Auditoria" no menu.

Operador:
- [ ] Não vê "Usuários" nem "Auditoria" no menu.

Minha conta (qualquer perfil — clique no nome no rodapé do menu):
- [ ] Mostra nome, e-mail e perfil.
- [ ] Senha atual errada: "Senha atual incorreta"; nova igual à atual: aviso; confirmação diferente: "As senhas não conferem".
- [ ] Troca com sucesso: mensagem de que as outras sessões foram encerradas e esta continua (F5 mantém o login); outra janela logada com o mesmo usuário cai para o login.

Auditoria (só administrador):
- [ ] Lista com data/hora, usuário, ação (ações sensíveis em vermelho), entidade, registro e IP; mais recentes primeiro.
- [ ] As ações feitas nos testes acima aparecem (criou usuário, redefiniu senha, desativou, alterou status de devedor, ativou regra...).
- [ ] Falha de login com e-mail inexistente aparece como "Sem usuário vinculado".
- [ ] Filtros de usuário, ação, entidade e período (De/Até); "Limpar filtros"; paginação com mais de 50 registros.

Mensagens de validação (todas as telas):
- [ ] Erros de validação escritos no back-end aparecem em português e por extenso (ex.: "O horário deve estar entre 08:00 e 20:00...") em vez de "Dados inválidos".
