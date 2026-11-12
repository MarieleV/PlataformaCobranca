// Vitest: testes unitários do front (funções puras, cliente HTTP e hooks).
// Rodar: npm test (uma vez) | npm run test:watch | npm run test:coverage
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test/setup.ts"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // Cobertura medida na lógica (lib, hooks, auth); as páginas são validadas pelo roteiro manual
      include: ["src/lib/**", "src/hooks/**", "src/auth/**"],
      exclude: ["src/lib/tipos.ts", "src/**/*.test.{ts,tsx}"],
      // Mesmo mínimo do back-end (RNF06): abaixo disso, `npm run test:coverage` falha
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 },
    },
  },
})
