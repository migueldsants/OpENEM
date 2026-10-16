/**
 * Listagem só das questões do seed demo (prova de slug 2023). As suítes de
 * import e de classificação criam e apagam questões próprias enquanto as
 * outras rodam em paralelo no mesmo banco, e "a primeira questão da lista"
 * pode ser uma delas e sumir no meio do teste — no Postgres as questões sem
 * prova vêm primeiro no `year desc`, porque ele ordena NULL antes.
 */
export const SEED_QUESTIONS_URL = '/api/v1/questions?examSlug=2023';
