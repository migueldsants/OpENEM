import { MagnifyingGlass } from '@phosphor-icons/react';
import { useId, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { buscar, GRUPOS, PAGINAS } from './conteudo';

/** Busca local nas páginas (sem serviço externo: a CSP só libera a própria origem). */
export function Busca({ aoEscolher }: { aoEscolher?: () => void }) {
  const [consulta, setConsulta] = useState('');
  const [foco, setFoco] = useState(0);
  const navegar = useNavigate();
  const lista = useId();
  const campo = useRef<HTMLInputElement>(null);
  const resultados = useMemo(() => buscar(PAGINAS, consulta), [consulta]);
  const aberta = consulta.trim().length > 1;

  function ir(url: string) {
    setConsulta('');
    aoEscolher?.();
    navegar(url);
  }

  return (
    <div className="relative">
      <label htmlFor={`${lista}-campo`} className="sr-only">
        Buscar na documentação
      </label>
      <MagnifyingGlass
        size={16}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
      />
      <input
        ref={campo}
        id={`${lista}-campo`}
        type="search"
        autoComplete="off"
        placeholder="Buscar"
        value={consulta}
        role="combobox"
        aria-expanded={aberta}
        aria-controls={lista}
        aria-activedescendant={aberta && resultados[foco] ? `${lista}-${foco}` : undefined}
        onChange={(e) => {
          setConsulta(e.target.value);
          setFoco(0);
        }}
        onKeyDown={(e) => {
          if (!aberta) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setFoco((f) => Math.min(f + 1, resultados.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setFoco((f) => Math.max(f - 1, 0));
          } else if (e.key === 'Enter' && resultados[foco]) {
            e.preventDefault();
            ir(resultados[foco].pagina.url);
          } else if (e.key === 'Escape') {
            setConsulta('');
          }
        }}
        className="input pl-9"
      />
      {aberta && (
        <ul
          id={lista}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-2 max-h-[min(26rem,70dvh)] overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow)]"
        >
          {resultados.length === 0 ? (
            <li className="px-3 py-3 text-sm text-muted">Nada encontrado para “{consulta.trim()}”.</li>
          ) : (
            resultados.map(({ pagina, trecho }, i) => (
              <li key={pagina.url} id={`${lista}-${i}`} role="option" aria-selected={i === foco}>
                <Link
                  to={pagina.url}
                  onClick={() => {
                    setConsulta('');
                    aoEscolher?.();
                  }}
                  onMouseEnter={() => setFoco(i)}
                  className={`block rounded-xl px-3 py-2.5 ${i === foco ? 'bg-surface-2' : ''}`}
                >
                  <span className="block text-sm font-semibold">{pagina.titulo}</span>
                  <span className="block text-xs text-muted">
                    {GRUPOS.find((g) => g.id === pagina.grupo)?.titulo}
                  </span>
                  <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-muted">{trecho}</span>
                </Link>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
