import { JwtService } from '@nestjs/jwt';
import { makeTracker } from './tracker';

describe('makeTracker', () => {
  const jwt = new JwtService({ secret: 'segredo-de-teste-comprido' });
  const track = makeTracker(jwt);
  const comToken = (token: string) => ({
    headers: { authorization: `Bearer ${token}` },
    ip: '10.0.0.1',
  });

  it('JWT válido conta pelo aluno', async () => {
    const token = await jwt.signAsync({ sub: 'u1', email: 'a@b.com' });
    await expect(track(comToken(token))).resolves.toBe('user:u1');
  });

  it('sem token, pelo IP', async () => {
    await expect(track({ headers: {}, ip: '10.0.0.1' })).resolves.toBe(
      'ip:10.0.0.1',
    );
  });

  it('token assinado com outro segredo conta pelo IP', async () => {
    const forjado = await new JwtService({
      secret: 'outro-segredo-qualquer',
    }).signAsync({ sub: 'qualquer' });
    await expect(track(comToken(forjado))).resolves.toBe('ip:10.0.0.1');
  });

  it('token vencido conta pelo IP', async () => {
    const vencido = await jwt.signAsync({ sub: 'u1' }, { expiresIn: -10 });
    await expect(track(comToken(vencido))).resolves.toBe('ip:10.0.0.1');
  });

  it('token sem sub conta pelo IP', async () => {
    const semSub = await jwt.signAsync({ email: 'a@b.com' });
    await expect(track(comToken(semSub))).resolves.toBe('ip:10.0.0.1');
  });

  it('lixo no cabeçalho conta pelo IP', async () => {
    await expect(track(comToken('nao.e.jwt'))).resolves.toBe('ip:10.0.0.1');
  });
});
