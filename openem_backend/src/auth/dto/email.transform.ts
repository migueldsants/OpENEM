import { Transform } from 'class-transformer';
import { normalizeEmail } from '../../common/rate-limit';

/**
 * E-mail sem espaços nas pontas e em minúsculas antes da validação: assim
 * " Ana@Exemplo.com" passa no `@IsEmail` e chega ao serviço como a conta é
 * gravada. Valor que não é texto segue intacto para o validador recusar.
 */
export const NormalizeEmail = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeEmail(value) : value,
  );
