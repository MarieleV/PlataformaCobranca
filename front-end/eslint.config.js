// ESLint (flat config): TypeScript + regras de hooks do React.
// Rodar: npm run lint
import js from "@eslint/js"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import globals from "globals"
import tseslint from "typescript-eslint"

export default tseslint.config(
  { ignores: ["dist", "coverage", "node_modules"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // Regras clássicas de hooks (ordem das chamadas e dependências dos efeitos)
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // Hot reload do Vite: arquivo de componente deve exportar só componentes.
      // allowConstantExport libera constantes (ex.: DESCRICAO_PERFIL).
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // Variáveis com _ no início podem ficar sem uso (ex.: parâmetros ignorados)
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    // Testes rodam no Node/Vitest
    files: ["src/**/*.test.{ts,tsx}", "src/test/**"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
)
