import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { RegisterDto } from './register.dto';

function erros(corpo: Record<string, unknown>): string[] {
  const dto = plainToInstance(RegisterDto, corpo);
  return validateSync(dto).map((e) => e.property);
}

describe('RegisterDto', () => {
  const base = {
    email: 'a@b.com',
    password: 'senhaForte123',
    nickname: 'maria',
  };

  it('aceita o cadastro com o aceite dos termos', () => {
    expect(erros({ ...base, acceptTerms: true })).toEqual([]);
  });

  it('exige o apelido e recusa os ofensivos', () => {
    const semApelido = { email: base.email, password: base.password };
    expect(erros({ ...semApelido, acceptTerms: true })).toEqual(['nickname']);
    expect(erros({ ...base, nickname: 'hitler', acceptTerms: true })).toEqual([
      'nickname',
    ]);
    expect(erros({ ...base, nickname: '', acceptTerms: true })).toEqual([
      'nickname',
    ]);
  });

  it('normaliza o apelido e devolve a mensagem do filtro', () => {
    const dto = plainToInstance(RegisterDto, {
      ...base,
      nickname: ' @Maria.Estuda ',
      acceptTerms: true,
    });
    expect(validateSync(dto)).toEqual([]);
    expect(dto.nickname).toBe('maria.estuda');

    const ruim = plainToInstance(RegisterDto, {
      ...base,
      nickname: 'odeio_catolicos',
      acceptTerms: true,
    });
    const [erro] = validateSync(ruim);
    expect(Object.values(erro.constraints ?? {})[0]).toMatch(/não é permitido/);
  });

  it('recusa sem o aceite, com false ou com "true" em texto', () => {
    expect(erros(base)).toEqual(['acceptTerms']);
    expect(erros({ ...base, acceptTerms: false })).toEqual(['acceptTerms']);
    expect(erros({ ...base, acceptTerms: 'true' })).toEqual(['acceptTerms']);
  });
});
