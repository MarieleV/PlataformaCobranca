import { useEffect } from "react"

/** Fecha com Esc. Use para painéis e modais. */
export function useFecharComEsc(onFechar: () => void, ativo = true) {
  useEffect(() => {
    if (!ativo) return
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar()
    }
    window.addEventListener("keydown", tecla)
    return () => window.removeEventListener("keydown", tecla)
  }, [onFechar, ativo])
}
