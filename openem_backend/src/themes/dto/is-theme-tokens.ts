import {
  buildMessage,
  ValidateBy,
  type ValidationOptions,
} from 'class-validator';
import { parseThemeTokens } from '../../common/theme-tokens';

/** Objeto com as 10 cores do tema, todas `#rrggbb` (ver common/theme-tokens). */
export function IsThemeTokens(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isThemeTokens',
      validator: {
        validate: (value: unknown) => parseThemeTokens(value) !== null,
        defaultMessage: buildMessage(
          (each) =>
            `${each}$property precisa ter as 10 cores do tema em #rrggbb`,
          options,
        ),
      },
    },
    options,
  );
}
