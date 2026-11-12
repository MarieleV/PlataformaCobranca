import type { Job } from "./tipos"

/** Job ainda sem desfecho (a tela continua atualizando). */
export function jobEmAndamento(job: Job): boolean {
  return job.status === "agendado" || job.status === "executando"
}
