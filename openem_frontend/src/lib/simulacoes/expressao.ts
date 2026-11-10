/**
 * Interpretador de expressões matemáticas para as funções que o aluno digita.
 * Não usa `eval` nem `new Function` (a CSP do app proíbe, e o texto vem do
 * aluno): o texto vira uma árvore por descida recursiva e a árvore vira uma
 * função comum.
 *
 * Aceita:
 * - números com ponto ou vírgula decimal (2.5 ou 2,5) e as constantes pi (π) e e;
 * - + − * / ^ e multiplicação implícita: 2x, 3sen(x), (x+1)(x−1), ax²;
 * - |x| para o módulo;
 * - funções em português ou inglês: sen/sin, cos, tg/tan, raiz/sqrt, ln,
 *   log (base 10), log(x; b) (base b), exp, abs, com ou sem parênteses
 *   ("sen x");
 * - a variável x e os parâmetros a, b, c, d, k, m, n, que viram controles.
 */

export const PARAMETROS = ['a', 'b', 'c', 'd', 'k', 'm', 'n'] as const;
export type Parametro = (typeof PARAMETROS)[number];

type No =
  | { t: 'num'; v: number }
  | { t: 'x' }
  | { t: 'par'; nome: Parametro }
  | { t: 'op'; op: '+' | '-' | '*' | '/' | '^'; a: No; b: No }
  | { t: 'neg'; a: No }
  | { t: 'fn'; nome: string; args: No[] };

const FUNCOES: Record<string, { aridade: number[]; f: (...v: number[]) => number }> = {
  sen: { aridade: [1], f: Math.sin },
  sin: { aridade: [1], f: Math.sin },
  cos: { aridade: [1], f: Math.cos },
  tg: { aridade: [1], f: Math.tan },
  tan: { aridade: [1], f: Math.tan },
  raiz: { aridade: [1], f: Math.sqrt },
  sqrt: { aridade: [1], f: Math.sqrt },
  ln: { aridade: [1], f: Math.log },
  log: { aridade: [1, 2], f: (x, b = 10) => Math.log(x) / Math.log(b) },
  exp: { aridade: [1], f: Math.exp },
  abs: { aridade: [1], f: Math.abs },
};
const CONSTANTES: Record<string, number> = { pi: Math.PI, 'π': Math.PI, e: Math.E };
/** Nomes conhecidos, do mais longo para o mais curto (para separar "xsen" em x·sen). */
const NOMES = [...Object.keys(FUNCOES), ...Object.keys(CONSTANTES)].sort((a, b) => b.length - a.length);

type Token =
  | { t: 'num'; v: number; pos: number }
  | { t: 'id'; v: string; pos: number }
  | { t: 'sim'; v: string; pos: number };

export class ErroExpressao extends Error {
  constructor(
    mensagem: string,
    readonly posicao: number,
  ) {
    super(mensagem);
  }
}

const SUPERESCRITOS: Record<string, string> = { '²': '^2', '³': '^3', '⁴': '^4' };

function tokenizar(texto: string): Token[] {
  const s = texto.replace(/[²³⁴]/g, (c) => SUPERESCRITOS[c]).replace(/[−–]/g, '-').replace(/[·×]/g, '*').replace(/÷/g, '/');
  const out: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(s[i + 1] ?? ''))) {
      let j = i;
      while (j < s.length && /[0-9]/.test(s[j])) j++;
      // Vírgula ou ponto decimal só entre dígitos (o ";" separa argumentos).
      if ((s[j] === '.' || s[j] === ',') && /[0-9]/.test(s[j + 1] ?? '')) {
        j++;
        while (j < s.length && /[0-9]/.test(s[j])) j++;
      }
      out.push({ t: 'num', v: Number(s.slice(i, j).replace(',', '.')), pos: i });
      i = j;
      continue;
    }
    if (/[a-zA-Zπ]/.test(ch)) {
      let j = i;
      while (j < s.length && /[a-zA-Zπ]/.test(s[j])) j++;
      const palavra = s.slice(i, j).toLowerCase();
      // Separa a palavra em nomes conhecidos e letras soltas: "axsen" → a, x, sen.
      let k = 0;
      while (k < palavra.length) {
        const nome = NOMES.find((n) => palavra.startsWith(n, k));
        const pedaco = nome ?? palavra[k];
        out.push({ t: 'id', v: pedaco, pos: i + k });
        k += pedaco.length;
      }
      i = j;
      continue;
    }
    if ('+-*/^()|;'.includes(ch)) {
      out.push({ t: 'sim', v: ch, pos: i });
      i++;
      continue;
    }
    throw new ErroExpressao(`Não entendi o símbolo "${ch}".`, i);
  }
  return out;
}

class Leitor {
  private i = 0;
  private dentroDeModulo = 0;
  constructor(
    private readonly tk: Token[],
    private readonly fim: number,
  ) {}

  private olhar() {
    return this.tk[this.i];
  }
  private comer() {
    return this.tk[this.i++];
  }
  private esperar(v: string) {
    const t = this.comer();
    if (!t || t.t !== 'sim' || t.v !== v) throw new ErroExpressao(v === ')' ? 'Falta fechar um parêntese.' : `Esperava "${v}".`, t?.pos ?? this.fim);
  }

  ler(): No {
    if (!this.tk.length) throw new ErroExpressao('Digite uma função de x.', 0);
    const no = this.soma();
    const t = this.olhar();
    if (t) throw new ErroExpressao(t.t === 'sim' && t.v === ')' ? 'Tem um parêntese fechando sem ter aberto.' : `Não esperava "${t.v}" aqui.`, t.pos);
    return no;
  }

  private soma(): No {
    let a = this.produto();
    for (;;) {
      const t = this.olhar();
      if (t?.t === 'sim' && (t.v === '+' || t.v === '-')) {
        this.comer();
        a = { t: 'op', op: t.v, a, b: this.produto() };
      } else return a;
    }
  }

  /** Começa um fator (para a multiplicação implícita: 2x, x(x+1), 3sen x). */
  private comecaFator(t: Token | undefined) {
    if (!t) return false;
    if (t.t === 'num' || t.t === 'id') return true;
    if (t.t === 'sim' && t.v === '(') return true;
    // "|" abre um módulo só quando não estamos esperando fechar um.
    return t.t === 'sim' && t.v === '|' && this.dentroDeModulo === 0;
  }

  private produto(): No {
    let a = this.unario();
    for (;;) {
      const t = this.olhar();
      if (t?.t === 'sim' && (t.v === '*' || t.v === '/')) {
        this.comer();
        a = { t: 'op', op: t.v, a, b: this.unario() };
      } else if (this.comecaFator(t)) {
        a = { t: 'op', op: '*', a, b: this.potencia() };
      } else return a;
    }
  }

  private unario(): No {
    const t = this.olhar();
    if (t?.t === 'sim' && (t.v === '-' || t.v === '+')) {
      this.comer();
      const a = this.unario();
      return t.v === '-' ? { t: 'neg', a } : a;
    }
    return this.potencia();
  }

  private potencia(): No {
    const base = this.primario();
    const t = this.olhar();
    if (t?.t === 'sim' && t.v === '^') {
      this.comer();
      if (!this.olhar()) throw new ErroExpressao('Falta o expoente depois do "^".', t.pos + 1);
      // Expoente associa à direita e aceita sinal: 2^-x, x^2^3.
      return { t: 'op', op: '^', a: base, b: this.unario() };
    }
    return base;
  }

  private primario(): No {
    const t = this.comer();
    if (!t) throw new ErroExpressao('A expressão terminou no meio: falta um número ou um x.', this.fim);
    if (t.t === 'num') return { t: 'num', v: t.v };
    if (t.t === 'sim' && t.v === '(') {
      const salvo = this.dentroDeModulo;
      this.dentroDeModulo = 0;
      const a = this.soma();
      this.dentroDeModulo = salvo;
      this.esperar(')');
      return a;
    }
    if (t.t === 'sim' && t.v === '|') {
      this.dentroDeModulo++;
      const a = this.soma();
      this.dentroDeModulo--;
      const f = this.comer();
      if (!f || f.t !== 'sim' || f.v !== '|') throw new ErroExpressao('Falta fechar o módulo com "|".', f?.pos ?? this.fim);
      return { t: 'fn', nome: 'abs', args: [a] };
    }
    if (t.t === 'id') {
      if (t.v === 'x') return { t: 'x' };
      if (t.v in CONSTANTES) return { t: 'num', v: CONSTANTES[t.v] };
      if ((PARAMETROS as readonly string[]).includes(t.v)) return { t: 'par', nome: t.v as Parametro };
      const fn = FUNCOES[t.v];
      if (fn) {
        const prox = this.olhar();
        if (prox?.t === 'sim' && prox.v === '(') {
          this.comer();
          const salvo = this.dentroDeModulo;
          this.dentroDeModulo = 0;
          const args = [this.soma()];
          while (this.olhar()?.t === 'sim' && this.olhar()!.v === ';') {
            this.comer();
            args.push(this.soma());
          }
          this.dentroDeModulo = salvo;
          this.esperar(')');
          if (!fn.aridade.includes(args.length)) throw new ErroExpressao(`"${t.v}" não recebe ${args.length} valores.`, t.pos);
          return { t: 'fn', nome: t.v, args };
        }
        // Sem parênteses vale para o próximo fator: "sen x", "ln x²" (em "sen 2x", só o 2).
        if (!prox) throw new ErroExpressao(`Falta o que vai dentro de "${t.v}".`, this.fim);
        return { t: 'fn', nome: t.v, args: [this.potencia()] };
      }
      throw new ErroExpressao(`A letra "${t.v}" não é a variável x nem um parâmetro (${PARAMETROS.join(', ')}).`, t.pos);
    }
    if (t.t === 'sim' && t.v === ')') throw new ErroExpressao('Tem um parêntese fechando sem ter aberto.', t.pos);
    throw new ErroExpressao(`Não esperava "${t.v}" aqui.`, t.pos);
  }
}

export type Valores = Partial<Record<Parametro, number>>;

export interface Compilada {
  f: (x: number, p?: Valores) => number;
  /** Parâmetros que aparecem na expressão, na ordem de PARAMETROS. */
  parametros: Parametro[];
}

function compilar(no: No): (x: number, p: Valores) => number {
  switch (no.t) {
    case 'num': {
      const v = no.v;
      return () => v;
    }
    case 'x':
      return (x) => x;
    case 'par': {
      const n = no.nome;
      return (_x, p) => p[n] ?? 1;
    }
    case 'neg': {
      const a = compilar(no.a);
      return (x, p) => -a(x, p);
    }
    case 'op': {
      const a = compilar(no.a);
      const b = compilar(no.b);
      switch (no.op) {
        case '+':
          return (x, p) => a(x, p) + b(x, p);
        case '-':
          return (x, p) => a(x, p) - b(x, p);
        case '*':
          return (x, p) => a(x, p) * b(x, p);
        case '/':
          return (x, p) => a(x, p) / b(x, p);
        case '^':
          return (x, p) => potencia(a(x, p), b(x, p));
      }
      break;
    }
    case 'fn': {
      const fn = FUNCOES[no.nome].f;
      const args = no.args.map(compilar);
      return (x, p) => fn(...args.map((g) => g(x, p)));
    }
  }
  throw new Error('nó desconhecido');
}

/** Potência que aceita raiz ímpar de negativo: (−8)^(1/3) = −2, como na calculadora da escola. */
function potencia(b: number, e: number) {
  if (b < 0 && !Number.isInteger(e)) {
    // Expoente racional com denominador ímpar pequeno.
    for (let q = 3; q <= 15; q += 2) {
      const pnum = Math.round(e * q);
      if (Math.abs(e * q - pnum) < 1e-9) return (pnum % 2 === 0 ? 1 : -1) * Math.abs(b) ** e;
    }
    return NaN;
  }
  return b ** e;
}

function coletar(no: No, out: Set<Parametro>) {
  if (no.t === 'par') out.add(no.nome);
  else if (no.t === 'op') {
    coletar(no.a, out);
    coletar(no.b, out);
  } else if (no.t === 'neg') coletar(no.a, out);
  else if (no.t === 'fn') no.args.forEach((a) => coletar(a, out));
}

/** Lê o texto e devolve a função (ou lança ErroExpressao com a posição do problema). */
export function interpretar(texto: string): Compilada {
  const tk = tokenizar(texto);
  const arvore = new Leitor(tk, texto.length).ler();
  const usados = new Set<Parametro>();
  coletar(arvore, usados);
  const g = compilar(arvore);
  return { f: (x, p = {}) => g(x, p), parametros: PARAMETROS.filter((p) => usados.has(p)) };
}

/** Versão que não lança: devolve o erro como texto. */
export function tentarInterpretar(texto: string): { ok: true; fn: Compilada } | { ok: false; erro: string; posicao: number } {
  try {
    return { ok: true, fn: interpretar(texto) };
  } catch (e) {
    if (e instanceof ErroExpressao) return { ok: false, erro: e.message, posicao: e.posicao };
    return { ok: false, erro: 'Expressão inválida.', posicao: 0 };
  }
}

/**
 * Zeros de f em [x0, x1]: troca de sinal entre amostras vizinhas, refinada
 * por bissecção. Descarta assíntotas (1/x troca de sinal em 0 sem zerar) e
 * junta zeros repetidos. Toques sem troca de sinal (x² em 0) entram quando o
 * mínimo de |f| local chega a quase zero.
 */
export function zeros(f: (x: number) => number, x0: number, x1: number, amostras = 1200): number[] {
  const out: number[] = [];
  const passo = (x1 - x0) / amostras;
  let xa = x0;
  let fa = f(xa);
  const add = (r: number) => {
    if (!out.some((q) => Math.abs(q - r) < passo * 1.5)) out.push(r);
  };
  for (let i = 1; i <= amostras; i++) {
    const xb = x0 + i * passo;
    const fb = f(xb);
    if (Number.isFinite(fa) && Number.isFinite(fb)) {
      if (fa === 0) add(xa);
      else if (fa * fb < 0) {
        let lo = xa;
        let hi = xb;
        let flo = fa;
        for (let k = 0; k < 60; k++) {
          const m = (lo + hi) / 2;
          const fm = f(m);
          if (!Number.isFinite(fm)) break;
          if (flo * fm <= 0) hi = m;
          else {
            lo = m;
            flo = fm;
          }
        }
        const r = (lo + hi) / 2;
        const escala = Math.max(1, Math.abs(fa), Math.abs(fb));
        if (Math.abs(f(r)) < 1e-6 * escala) add(r);
      } else if (i >= 2) {
        // Toque: |f| tem um mínimo local muito perto de zero.
        const xm = xa - passo;
        const fm = f(xm);
        if (Number.isFinite(fm) && Math.abs(fa) < Math.abs(fm) && Math.abs(fa) < Math.abs(fb) && Math.abs(fa) < 1e-9) add(xa);
      }
    }
    xa = xb;
    fa = fb;
  }
  return out.sort((p, q) => p - q);
}

/** Arredonda um zero numérico para mostrar: 1,9999999 vira 2. */
export const limparZero = (r: number) => (Math.abs(r - Math.round(r)) < 1e-7 ? Math.round(r) : r);
