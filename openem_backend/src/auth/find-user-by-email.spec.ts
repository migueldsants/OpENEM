import { fakeAuthPrisma } from './fake-auth-prisma';
import { findUserByEmail } from './find-user-by-email';

describe('findUserByEmail', () => {
  it('igual exato primeiro, mesmo havendo outra conta em outra caixa', async () => {
    const prisma = fakeAuthPrisma();
    await prisma.user.create({ data: { email: 'Ana@x.com' } });
    await prisma.user.create({ data: { email: 'ana@x.com' } });
    const achado = await findUserByEmail(prisma, 'ana@x.com');
    expect(achado).toMatchObject({
      kind: 'found',
      user: { email: 'ana@x.com' },
    });
  });

  it('sem igual exato, aceita a única conta em outra caixa', async () => {
    const prisma = fakeAuthPrisma();
    await prisma.user.create({ data: { email: 'Ana@X.com' } });
    const achado = await findUserByEmail(prisma, ' ana@x.com ');
    expect(achado).toMatchObject({
      kind: 'found',
      user: { email: 'Ana@X.com' },
    });
  });

  it('duas contas em caixas diferentes, nenhuma exata: ambíguo', async () => {
    const prisma = fakeAuthPrisma();
    await prisma.user.create({ data: { email: 'Ana@x.com' } });
    await prisma.user.create({ data: { email: 'ANA@x.com' } });
    expect(await findUserByEmail(prisma, 'ana@x.com')).toEqual({
      kind: 'ambiguous',
    });
  });

  it('e-mail digitado com maiúsculas acha a conta gravada normalizada', async () => {
    const prisma = fakeAuthPrisma();
    await prisma.user.create({ data: { email: 'ana@x.com' } });
    await prisma.user.create({ data: { email: 'ANA@X.COM' } });
    expect(await findUserByEmail(prisma, ' Ana@X.com ')).toMatchObject({
      kind: 'found',
      user: { email: 'ana@x.com' },
    });
  });

  it('nenhuma conta', async () => {
    expect(await findUserByEmail(fakeAuthPrisma(), 'x@y.z')).toEqual({
      kind: 'none',
    });
  });
});
