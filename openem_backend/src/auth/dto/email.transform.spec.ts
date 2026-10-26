import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from './login.dto';
import { RegisterDto } from './register.dto';

describe('normalização do e-mail nos DTOs de auth', () => {
  it('apara e põe em minúsculas antes de validar', async () => {
    for (const Dto of [LoginDto, RegisterDto]) {
      const dto = plainToInstance(Dto, {
        email: '  Ana@Exemplo.COM ',
        password: 'senhaForte123',
      });
      expect(dto.email).toBe('ana@exemplo.com');
      expect(await validate(dto)).toHaveLength(0);
    }
  });

  it('deixa valor que não é texto para o validador recusar', async () => {
    const dto = plainToInstance(LoginDto, { email: 42, password: 'x' });
    expect(dto.email).toBe(42);
    const erros = await validate(dto);
    expect(erros.map((e) => e.property)).toContain('email');
  });
});
