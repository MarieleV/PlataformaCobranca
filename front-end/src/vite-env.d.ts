/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base da API (sem barra no fim). Padrão: http://localhost:8000 */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
