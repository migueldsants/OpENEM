import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { RegisterDto } from './register.dto';

function erros(corpo: Record<string, unknown>): string[] {
  const dto = plainToInstance(RegisterDto, corpo);
  return validateSync(dto).map((e) => e.property);
}

describe('RegisterDto', () => {
  const base = { email: 'a@b.com', password: 'senhaForte123' };

  it('aceita o cadastro com o aceite dos termos', () => {
    expect(erros({ ...base, acceptTerms: true })).toEqual([]);
  });

  it('recusa sem o aceite, com false ou com "true" em texto', () => {
    expect(erros(base)).toEqual(['acceptTerms']);
    expect(erros({ ...base, acceptTerms: false })).toEqual(['acceptTerms']);
    expect(erros({ ...base, acceptTerms: 'true' })).toEqual(['acceptTerms']);
  });
});
