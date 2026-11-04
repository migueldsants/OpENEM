import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { registerDecorator, type ValidationArguments } from 'class-validator';
import { checkNickname, normalizeNickname } from '../../common/nickname';

/**
 * Apelido normalizado (`@Maria` → `maria`) e conferido por `checkNickname`:
 * formato, palavrões, ofensas e nomes reservados. A mensagem do erro é a do
 * filtro, para o app mostrar ao aluno como veio.
 */
export const IsNickname = () =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? normalizeNickname(value) : value,
    ),
    (target: object, propertyName: string) =>
      registerDecorator({
        name: 'isNickname',
        target: target.constructor,
        propertyName,
        validator: {
          validate: (value: unknown) =>
            typeof value === 'string' && checkNickname(value).ok,
          defaultMessage: ({ value }: ValidationArguments) => {
            if (typeof value !== 'string') return 'Escolha um apelido.';
            const check = checkNickname(value);
            return check.ok ? '' : check.message;
          },
        },
      }),
  );
