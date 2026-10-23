import { useMemo, useState } from 'react';
import { massaParaConta, numeroBr, type Elemento } from '../../lib/elementos';
import { lerFormula, massaMolar } from '../../lib/massa-molar';

const EXEMPLOS = ['H2O', 'CO2', 'NaCl', 'C6H12O6', 'Ca(OH)2', 'H2SO4', 'CuSO4·5H2O', 'Al2(SO4)3'];

/** Fórmula com os índices em subscrito, para mostrar ("C₆H₁₂O₆"). */
function comSubscrito(f: string): string {
  return f.replace(/(?<=[A-Za-z)\]}])(\d+)/g, (d) => d.replace(/\d/g, (c) => '₀₁₂₃₄₅₆₇₈₉'[Number(c)]));
}

/**
 * Calculadora de massa molar com as massas abreviadas da CIAAW, as mesmas da
 * tabela: aceita parênteses, colchetes e hidratos ("CuSO4·5H2O").
 */
export function MassaMolar({ lista }: { lista: Elemento[] }) {
  const [formula, setFormula] = useState('CuSO4·5H2O');
  const simbolos = useMemo(() => new Set(lista.map((e) => e.simbolo)), [lista]);
  const massas = useMemo(() => new Map(lista.map((e) => [e.simbolo, massaParaConta(e)])), [lista]);
  const nomes = useMemo(() => new Map(lista.map((e) => [e.simbolo, e])), [lista]);
  const lido = useMemo(() => lerFormula(formula, simbolos), [formula, simbolos]);
  const resultado = lido.ok ? massaMolar(lido.contagem, lido.ordem, massas) : null;
  const radioativos = lido.ok ? lido.ordem.filter((s) => !nomes.get(s)?.massa.abreviado) : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div className="space-y-3">
        <label className="block text-xs font-medium text-muted" htmlFor="tp-formula">
          Fórmula
        </label>
        <input
          id="tp-formula"
          className="input font-data text-base"
          value={formula}
          onChange={(ev) => setFormula(ev.target.value)}
          placeholder="Ca(OH)2 ou CuSO4·5H2O"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-invalid={!lido.ok}
          aria-describedby="tp-formula-ajuda"
        />
        <p id="tp-formula-ajuda" className="text-xs text-muted" aria-live="polite">
          {lido.ok ? (
            <>Use a maiúscula de cada símbolo; para hidrato, separe com · ou ponto.</>
          ) : (
            <span className="text-danger">{lido.erro}</span>
          )}
        </p>
        <div className="flex flex-wrap gap-1.5" aria-label="Exemplos">
          {EXEMPLOS.map((ex) => (
            <button key={ex} type="button" className="chip font-data" data-active={formula === ex} onClick={() => setFormula(ex)}>
              {comSubscrito(ex)}
            </button>
          ))}
        </div>
      </div>

      <div className="min-w-0">
        {resultado ? (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted">Massa molar de {comSubscrito(formula.replace(/\s+/g, ''))}</p>
              <p className="font-data text-3xl font-semibold tabular-nums tracking-tight">
                {numeroBr(resultado.total, 3)} <span className="text-base text-muted">g/mol</span>
              </p>
            </div>
            <table className="w-full text-sm">
              <caption className="sr-only">Composição em massa</caption>
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th scope="col" className="pb-2 font-medium">Elemento</th>
                  <th scope="col" className="pb-2 text-right font-medium">Átomos</th>
                  <th scope="col" className="pb-2 text-right font-medium">Massa</th>
                  <th scope="col" className="w-2/5 pb-2 pl-4 font-medium">Em massa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {resultado.parcelas.map((p) => (
                  <tr key={p.simbolo}>
                    <th scope="row" className="py-2 text-left font-normal">
                      <span className="font-display font-bold">{p.simbolo}</span>{' '}
                      <span className="text-muted">{nomes.get(p.simbolo)?.nome}</span>
                    </th>
                    <td className="py-2 text-right font-data tabular-nums">{p.atomos}</td>
                    <td className="py-2 text-right font-data tabular-nums">
                      {p.atomos} × {numeroBr(p.massaAtomica, 4)} = {numeroBr(p.massa, 3)}
                    </td>
                    <td className="py-2 pl-4">
                      <div className="flex items-center gap-2">
                        <div className="tp-barra flex-1" aria-hidden>
                          <span style={{ transform: `scaleX(${p.porcentagem / 100})` }} />
                        </div>
                        <span className="w-14 text-right font-data tabular-nums">{numeroBr(p.porcentagem, 2)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-muted">
              Com as massas abreviadas da CIAAW (as da tabela). Livros e provas podem arredondar (H = 1, O = 16), e o
              resultado muda um pouco.
              {radioativos.length > 0 &&
                ` ${radioativos.join(', ')} não ${radioativos.length > 1 ? 'têm' : 'tem'} massa padrão: entra o número de massa do isótopo de vida mais longa.`}
            </p>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
            Corrija a fórmula para ver a massa molar.
          </p>
        )}
      </div>
    </div>
  );
}
