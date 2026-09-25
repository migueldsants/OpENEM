import type { PdfTheme } from '../api';
import { IconCheck } from './icons';

/**
 * Escolha de cor dos PDFs (caderno de prova e de fórmulas): os temas do app
 * mais uma cor livre, para quem quer a cor da própria escola.
 */
export function PdfThemePicker({
  temas,
  tema,
  corLivre,
  onTema,
  onCorLivre,
}: {
  temas: PdfTheme[] | null;
  tema: string;
  corLivre: string;
  onTema: (key: string) => void;
  onCorLivre: (hex: string) => void;
}) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-2">
      {(temas ?? []).map((t) => {
        const ativo = tema === t.key && !corLivre;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              onTema(t.key);
              onCorLivre('');
            }}
            aria-label={`Tema ${t.label}`}
            aria-pressed={ativo}
            className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
              ativo
                ? 'border-brand bg-brand/8 font-semibold'
                : 'border-line hover:bg-surface-2'
            }`}
          >
            <span
              className="size-4 rounded-full border border-line"
              style={{ backgroundColor: t.brand }}
            />
            {t.label}
            {ativo && <IconCheck width={11} height={11} />}
          </button>
        );
      })}
      <label
        className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
          corLivre ? 'border-brand bg-brand/8 font-semibold' : 'border-line'
        }`}
      >
        <input
          type="color"
          value={corLivre || '#e0234e'}
          onChange={(e) => onCorLivre(e.target.value)}
          aria-label="Cor personalizada"
          className="size-4 cursor-pointer border-0 bg-transparent p-0"
        />
        Minha cor
      </label>
    </div>
  );
}
