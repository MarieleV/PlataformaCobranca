// Regras de usuários do lado do front. Espelham back-end/app/schemas/usuario.py
// (SenhaForte: 8–128 caracteres, ao menos uma letra e um número; nome 2–150).

/** Mensagem de erro da senha, ou null se atende à política. */
export function validarSenha(senha: string): string | null {
  if (senha.length < 8) return "A senha deve ter pelo menos 8 caracteres."
  if (senha.length > 128) return "A senha deve ter no máximo 128 caracteres."
  if (!/[A-Za-z]/.test(senha) || !/\d/.test(senha)) return "A senha deve ter ao menos uma letra e um número."
  return null
}

export function validarNome(nome: string): string | null {
  const n = nome.trim()
  return n.length < 2 || n.length > 150 ? "Use de 2 a 150 caracteres." : null
}

/** Validação simples de formato; a definitiva é a do back-end (EmailStr). */
export function validarEmail(email: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? null : "Informe um e-mail válido."
}

/** Senha aleatória que atende à política (para a senha inicial / redefinição). */
export function gerarSenha(tamanho = 12): string {
  const letras = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ"
  const numeros = "23456789"
  const todos = letras + numeros
  const aleatorio = (n: number) => {
    const v = new Uint32Array(1)
    crypto.getRandomValues(v)
    return v[0] % n
  }
  const chars = [letras[aleatorio(letras.length)], numeros[aleatorio(numeros.length)]]
  while (chars.length < tamanho) chars.push(todos[aleatorio(todos.length)])
  // embaralha (Fisher–Yates) para a letra e o número não ficarem sempre no início
  for (let i = chars.length - 1; i > 0; i--) {
    const j = aleatorio(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join("")
}

/** Nome amigável das ações registradas na auditoria (registrar_auditoria no back-end). */
export const NOME_ACAO: Record<string, string> = {
  login: "Login",
  login_falha: "Falha de login",
  logout: "Logout",
  alterar_propria_senha: "Trocou a própria senha",
  criar_usuario: "Criou usuário",
  editar_usuario: "Editou usuário",
  alterar_perfil_usuario: "Alterou perfil de usuário",
  ativar_usuario: "Ativou usuário",
  desativar_usuario: "Desativou usuário",
  redefinir_senha: "Redefiniu senha de usuário",
  excluir_usuario: "Excluiu usuário",
  criar_regra: "Criou regra",
  editar_regra: "Editou regra",
  ativar_regra: "Ativou regra",
  desativar_regra: "Desativou regra",
  excluir_regra: "Excluiu regra",
  executar_regra: "Executou regra manualmente",
  alterar_status_devedor: "Alterou status de devedor",
  excluir_devedor: "Excluiu devedor (LGPD)",
}

export const NOME_ENTIDADE: Record<string, string> = {
  usuario: "Usuário",
  regra: "Regra",
  devedor: "Devedor",
}
