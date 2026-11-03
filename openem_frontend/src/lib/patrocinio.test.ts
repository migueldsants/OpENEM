// Quando o convite para patrocinar aparece: uma vez por login, com carência
// para conta nova e adiamento quando o aluno dispensa.
import { describe, expect, it } from 'vitest';
import {
  ADIAR_MS,
  APOIOU_MS,
  CARENCIA_MS,
  CHAVE_PATROCINIO,
  deveMostrar,
  gravarEstado,
  lerEstado,
  marcarMostrado,
  responder,
  sessaoDoToken,
} from './patrocinio';

const AGORA = Date.UTC(2026, 10, 2, 12);
const CONTA_ANTIGA = AGORA - 30 * 24 * 60 * 60 * 1000;

function jwt(payload: object): string {
  const b64 = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `cabecalho.${b64}.assinatura`;
}

describe('sessaoDoToken', () => {
  it('identifica o login pelo sub e pelo iat, sem guardar o token', () => {
    expect(sessaoDoToken(jwt({ sub: 'u1', iat: 1700000000 }))).toBe('u1:1700000000');
  });

  it('cada login (iat novo) é uma sessão nova', () => {
    expect(sessaoDoToken(jwt({ sub: 'u1', iat: 1 }))).not.toBe(sessaoDoToken(jwt({ sub: 'u1', iat: 2 })));
  });

  it('token ausente, malformado ou sem sub/iat não vira sessão', () => {
    expect(sessaoDoToken(null)).toBeNull();
    expect(sessaoDoToken('lixo')).toBeNull();
    expect(sessaoDoToken('a.%%%.c')).toBeNull();
    expect(sessaoDoToken(jwt({ sub: 'u1' }))).toBeNull();
    expect(sessaoDoToken(jwt({ iat: 1 }))).toBeNull();
  });
});

describe('deveMostrar', () => {
  const base = { estado: {}, sessao: 'u1:1', agora: AGORA, contaCriadaEm: CONTA_ANTIGA };

  it('aparece no primeiro login de uma conta que já passou da carência', () => {
    expect(deveMostrar(base)).toBe(true);
  });

  it('não aparece de novo no mesmo login', () => {
    expect(deveMostrar({ ...base, estado: marcarMostrado({}, 'u1:1') })).toBe(false);
  });

  it('volta no login seguinte', () => {
    expect(deveMostrar({ ...base, estado: { sessao: 'u1:1' }, sessao: 'u1:2' })).toBe(true);
  });

  it('sem sessão não aparece', () => {
    expect(deveMostrar({ ...base, sessao: null })).toBe(false);
  });

  it('conta nova espera a carência', () => {
    expect(deveMostrar({ ...base, contaCriadaEm: AGORA - 60_000 })).toBe(false);
    expect(deveMostrar({ ...base, contaCriadaEm: AGORA - CARENCIA_MS + 1 })).toBe(false);
    expect(deveMostrar({ ...base, contaCriadaEm: AGORA - CARENCIA_MS })).toBe(true);
  });

  it('data de criação inválida não segura o convite', () => {
    expect(deveMostrar({ ...base, contaCriadaEm: Number.NaN })).toBe(true);
    expect(deveMostrar({ ...base, contaCriadaEm: undefined })).toBe(true);
  });

  it('adiado não aparece nem em login novo até o prazo', () => {
    const estado = { sessao: 'u1:0', adiadoAte: AGORA + 1 };
    expect(deveMostrar({ ...base, estado })).toBe(false);
    expect(deveMostrar({ ...base, estado, agora: AGORA + 1 })).toBe(true);
  });
});

describe('responder', () => {
  const estado = { sessao: 'u1:1' };

  it('"Agora não" adia uma semana', () => {
    expect(responder(estado, 'agora-nao', AGORA)).toEqual({ sessao: 'u1:1', adiadoAte: AGORA + ADIAR_MS });
  });

  it('ir ao GitHub Sponsors adia três meses', () => {
    expect(responder(estado, 'patrocinar', AGORA).adiadoAte).toBe(AGORA + APOIOU_MS);
  });

  it('fechar (X, Esc, clique fora) só vale para este login', () => {
    const depois = responder(estado, 'fechar', AGORA);
    expect(depois).toEqual(estado);
    expect(deveMostrar({ estado: depois, sessao: 'u1:2', agora: AGORA + 1, contaCriadaEm: CONTA_ANTIGA })).toBe(
      true,
    );
  });
});

describe('lerEstado / gravarEstado', () => {
  function memoria(inicial?: string) {
    const dados = new Map<string, string>();
    if (inicial !== undefined) dados.set(CHAVE_PATROCINIO, inicial);
    return {
      dados,
      getItem: (k: string) => dados.get(k) ?? null,
      setItem: (k: string, v: string) => void dados.set(k, v),
    };
  }

  it('grava e lê de volta', () => {
    const s = memoria();
    gravarEstado(s, { sessao: 'u1:1', adiadoAte: 42 });
    expect(lerEstado(s)).toEqual({ sessao: 'u1:1', adiadoAte: 42 });
  });

  it('valor corrompido ou de tipo errado vira estado vazio', () => {
    expect(lerEstado(memoria('{quebrado'))).toEqual({});
    expect(lerEstado(memoria('null'))).toEqual({});
    expect(lerEstado(memoria('{"sessao":1,"adiadoAte":"amanhã"}'))).toEqual({});
  });

  it('localStorage ausente ou que lança não quebra', () => {
    const quebrado = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('cheio');
      },
    };
    expect(lerEstado(quebrado)).toEqual({});
    expect(() => gravarEstado(quebrado, { sessao: 'x' })).not.toThrow();
    expect(lerEstado(undefined)).toEqual({});
  });
});
