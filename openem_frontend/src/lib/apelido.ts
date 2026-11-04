/**
 * Apelido do aluno: o nome público no fórum, no ranking, no perfil público e
 * nos temas. Aqui só o formato, para avisar enquanto o aluno digita; o filtro
 * de palavrões, ofensas e nomes reservados e a checagem de "já em uso" ficam
 * no servidor (`openem_backend/src/common/nickname.ts`), que manda a mensagem.
 */

export const APELIDO_MIN = 3;
export const APELIDO_MAX = 20;

/** Como o servidor grava: sem espaços nas pontas, sem `@` na frente, minúsculo. */
export function normalizarApelido(texto: string): string {
  return texto.trim().replace(/^@+/, '').toLowerCase();
}

/** Problema de formato do apelido já normalizado, ou `null` se está ok. */
export function erroDeFormato(apelido: string): string | null {
  if (apelido.length < APELIDO_MIN || apelido.length > APELIDO_MAX) {
    return `O apelido precisa ter de ${APELIDO_MIN} a ${APELIDO_MAX} caracteres.`;
  }
  if (!/^[a-z0-9_.]+$/.test(apelido)) {
    return 'Use só letras sem acento, números, ponto (.) e sublinhado (_), sem espaços.';
  }
  if (apelido.startsWith('.') || apelido.endsWith('.') || apelido.includes('..')) {
    return 'O apelido não pode começar nem terminar com ponto, nem ter dois pontos seguidos.';
  }
  if (!/[a-z]/.test(apelido)) return 'O apelido precisa ter pelo menos uma letra.';
  return null;
}

/** Nome público de quem ainda não escolheu apelido. */
export const SEM_APELIDO = 'Estudante';
