import { useId } from 'react';
import { APELIDO_MAX, erroDeFormato, normalizarApelido } from '../lib/apelido';

/**
 * Campo do apelido (cadastro, tela de escolha e Perfil). Mostra o problema de
 * formato enquanto o aluno digita; o resto (ofensivo, reservado, em uso) vem
 * do servidor ao salvar.
 */
export function CampoApelido({
  value,
  onChange,
  onBlur,
  disabled,
  autoFocus,
  label = 'Apelido',
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
  label?: string;
}) {
  const id = useId();
  const normalizado = normalizarApelido(value);
  const erro = normalizado ? erroDeFormato(normalizado) : null;
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <div className="relative mt-1.5">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-sm text-muted"
        >
          @
        </span>
        <input
          type="text"
          required
          // O "@" vem desenhado; quem digitar um a mais não estoura o limite.
          maxLength={APELIDO_MAX + 1}
          autoComplete="nickname"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={erro !== null}
          aria-describedby={id}
          className="input pl-7"
          placeholder="seu.apelido"
        />
      </div>
      <span
        id={id}
        className={`mt-1.5 block text-xs ${erro ? 'text-danger' : 'text-muted'}`}
      >
        {erro ??
          'Aparece no fórum e no ranking. Use letras, números, ponto ou sublinhado. Palavrões e ofensas não são aceitos.'}
      </span>
    </label>
  );
}
