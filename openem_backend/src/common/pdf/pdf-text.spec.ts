import { pdfSafeText, splitRuns } from './pdf-text';

describe('pdfSafeText', () => {
  it('compõe acento decomposto (NFD) em caractere acentuado', () => {
    const nfd = 'reação química';
    expect(pdfSafeText(nfd)).toBe('reação química');
  });

  it('mantém índices, setas e o sinal de menos', () => {
    const texto = 'Cr₂O₃ (g · mol⁻¹) → 2 Cr³⁺ ≤ x − 1';
    expect(pdfSafeText(texto)).toBe(texto);
  });

  it('tira caractere de controle e de uso privado da extração', () => {
    expect(pdfSafeText('IMC 29,1\u0082estando')).toBe('IMC 29,1estando');
    expect(pdfSafeText('por qué')).toBe('por qué');
    expect(pdfSafeText('a\u001Bb\u0098c')).toBe('abc');
  });

  it('preserva quebra de linha e tabulação', () => {
    expect(pdfSafeText('a\n\tb')).toBe('a\n\tb');
  });

  it('troca o símbolo pelo equivalente que a fonte tem, sem mudar o sentido', () => {
    expect(pdfSafeText('A = k⋅m')).toBe('A = k·m');
    expect(pdfSafeText('constante 𝜋')).toBe('constante π');
    expect(pdfSafeText('∛16')).toBe('³√16');
    expect(pdfSafeText('(∼600 nm)')).toBe('(~600 nm)');
  });

  it('não mexe nos símbolos que vão para a fonte de símbolos', () => {
    expect(pdfSafeText('C≡N, x ∈ A, ⇌, π ≅ 3')).toBe('C≡N, x ∈ A, ⇌, π ≅ 3');
  });
});

describe('splitRuns', () => {
  // Fonte principal "sem ≡", reserva "com ≡".
  const principal = (cp: number) => cp !== 0x2261 && cp !== 0x1f600;
  const reserva = (cp: number) => cp === 0x2261;

  it('texto que a principal cobre é um trecho só', () => {
    expect(splitRuns('C=N', principal, reserva)).toEqual([
      { text: 'C=N', fallback: false },
    ]);
  });

  it('separa o símbolo que só a reserva tem', () => {
    expect(splitRuns('C≡N e C≡C', principal, reserva)).toEqual([
      { text: 'C', fallback: false },
      { text: '≡', fallback: true },
      { text: 'N e C', fallback: false },
      { text: '≡', fallback: true },
      { text: 'C', fallback: false },
    ]);
  });

  it('caractere que nenhuma das duas tem fica na principal', () => {
    expect(splitRuns('a😀b', principal, reserva)).toEqual([
      { text: 'a😀b', fallback: false },
    ]);
  });

  it('texto vazio não gera trecho', () => {
    expect(splitRuns('', principal, reserva)).toEqual([]);
  });
});
