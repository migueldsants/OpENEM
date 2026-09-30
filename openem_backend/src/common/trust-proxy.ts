/**
 * Valor do `trust proxy` do Express, lido de TRUST_PROXY.
 *
 * Atrás do nginx do docker-compose toda requisição chega com o IP do
 * container. Sem confiar no proxy, o rate limiting por IP vira um contador só
 * para o site inteiro: dez senhas erradas de um atacante bloqueiam o login de
 * todos. Confiar sem ter proxy na frente é o erro oposto: o cliente forja o
 * X-Forwarded-For e ganha um contador novo a cada requisição. Por isso o
 * padrão é não confiar, e o compose liga com TRUST_PROXY=1.
 *
 * Aceita o número de proxies à frente da API ("1") ou uma lista de endereços
 * e sub-redes no formato do Express ("loopback, 10.0.0.0/8"). `true` é
 * recusado: com ele o Express usa o endereço mais à esquerda do cabeçalho, que
 * é justamente o que o cliente escreve.
 */
export function parseTrustProxy(
  raw: string | undefined,
): number | string | false | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  if (/^\d+$/.test(value)) return Number(value);
  const lower = value.toLowerCase();
  if (lower === 'false') return false;
  if (lower === 'true') {
    throw new Error(
      'TRUST_PROXY=true deixa o cliente escolher o próprio IP. Use o número de proxies à frente da API (ex.: TRUST_PROXY=1).',
    );
  }
  return value;
}
