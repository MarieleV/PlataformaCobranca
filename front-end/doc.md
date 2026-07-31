# figma-make-app

Projeto React + Vite + Tailwind CSS em execução no Figma Make.

## Servidor de Desenvolvimento

Um servidor de desenvolvimento Vite **já está em execução** na porta `$PORT` (padrão 8443). Você não precisa iniciá-lo manualmente.

- URL de pré-visualização: O usuário pode acessar o aplicativo em execução através do painel de pré-visualização
- Hot reload: Alterações nos arquivos de código-fonte são refletidas imediatamente

## Estrutura do Projeto

Esta é a estrutura canônica do projeto. Comece pelos arquivos relevantes para a tarefa listados abaixo. Siga os imports ou inspecione outros arquivos apenas quando necessário, quando um caminho documentado estiver faltando ou quando o repositório contradizer este guia.

- `src/main.tsx` - Ponto de entrada do React; importa `src/index.css` e monta `src/App.tsx` no elemento `#root`
- `src/App.tsx` - Componente principal da aplicação e ponto de partida habitual para o trabalho de interface (UI)
- `src/index.css` - Ponto de entrada de CSS global e importação do Tailwind CSS v4
- `index.html` - Shell HTML do Vite contendo o elemento `#root` e carregando `src/main.tsx`
- `package.json` - Dependências do projeto e scripts do Vite para build, desenvolvimento, pré-visualização e formatação
- `vite.config.ts` - Configuração do Vite com plugins para React, Tailwind CSS v4 e Figma Make, além do alias `@` para `src`
- `.mise.toml` - Versões da toolchain para Node.js e pnpm

## Dependências

- Runtime: React 19 e React DOM 19
- Estilização: Tailwind CSS v4 com o plugin `@tailwindcss/vite`
- Ferramentas de build: Vite 8, TypeScript 5.7 e `@vitejs/plugin-react`
- Formatação: oxfmt

## Estilização

Este projeto utiliza **Tailwind CSS v4** através do plugin `@tailwindcss/vite` configurado em `vite.config.ts`. O arquivo `src/index.css` importa o Tailwind com `@import 'tailwindcss';`. Utilize classes utilitárias do Tailwind diretamente no JSX e coloque CSS global ou personalizações de tema do Tailwind v4 em `src/index.css`. Esta estrutura inicial não requer arquivo de configuração do Tailwind ou do PostCSS. O arquivo `src/main.tsx` importa `src/index.css`; portanto, a configuração global de fontes deve ficar em `src/index.css`. Coloque as diretivas `@import` do CSS no início e, em seguida, adicione as regras `@font-face` e as definições padrão de `font-family`.

## Qualidade do código

- Use aspas duplas para strings que contenham apóstrofos (`"We're here to help"`) ou faça o escape deles em strings com aspas simples. Um apóstrofo sem escape em uma string delimitada por aspas simples causa falha no build.
- Certifique-se de que as tags JSX estejam fechadas e as chaves estejam balanceadas.
- Exporte os componentes como *default exports*.