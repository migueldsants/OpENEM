import { randomBytes } from 'node:crypto';
import { checkNickname } from '../src/common/nickname';

/**
 * Apelido novo a cada chamada: o apelido é único e as suítes rodam em
 * paralelo no mesmo banco. Sorteia de novo no caso raro de o filtro barrar
 * os números lidos como letras.
 */
export function testNickname(): string {
  let nick: string;
  do {
    nick = `e2e_${randomBytes(6).toString('hex')}`;
  } while (!checkNickname(nick).ok);
  return nick;
}
