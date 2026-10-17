// ENEM antigo (1998–2008) e PPL de 2010/2011: o layout do caderno de 63
// questões e o gabarito que só existe nos microdados do INEP.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cabecalhoAntigo, sequenciaDeCabecalhos, trechosDeAlternativas, letraAntiga, deMacRoman, marcaDagua } from './parse.mjs';
import { questoesDoApoio } from './comum.mjs';
import { gabaritoDoTexto, gabaritosPorProva, itensPorProva } from './gabaritos-antigos.mjs';

test('cabeçalho antigo: número solto, "1.", "03 O texto..." e "Questão 7"', () => {
  assert.deepEqual(cabecalhoAntigo(['1']), { n: 1, resto: '', consumidos: 1 });
  assert.deepEqual(cabecalhoAntigo(['1.']), { n: 1, resto: '', consumidos: 1 });
  // 1998/1999: o número vem colado ao começo do enunciado
  assert.deepEqual(cabecalhoAntigo(['03', 'O texto retrata duas situações']), { n: 3, resto: 'O texto retrata duas situações', consumidos: 1 });
  assert.deepEqual(cabecalhoAntigo(['Questão', '17']), { n: 17, resto: '', consumidos: 2 });
  // 2006: a própria palavra vem picada em itens
  assert.deepEqual(cabecalhoAntigo(['Quest', 'ã', 'o', '36']), { n: 36, resto: '', consumidos: 4 });
  assert.equal(cabecalhoAntigo(['4 pessoas foram']), null);
  assert.equal(cabecalhoAntigo(['O texto']), null);
});

test('a sequência de cabeçalhos ignora as instruções numeradas da capa', () => {
  // Capa (1..12, letra menor) e depois a prova (1..20, letra maior). A capa
  // emendada com 13..20 da prova empata com a prova inteira: fica a que
  // começa depois.
  const capa = Array.from({ length: 12 }, (_, i) => ({ n: i + 1, alt: 9 }));
  const prova = Array.from({ length: 20 }, (_, i) => ({ n: i + 1, alt: 12 }));
  const idx = sequenciaDeCabecalhos([...capa, ...prova]);
  assert.deepEqual(idx, Array.from({ length: 20 }, (_, i) => 12 + i));
});

test('a sequência tolera um cabeçalho perdido e descarta número de tabela', () => {
  const cands = [
    { n: 1, alt: 12 }, { n: 2, alt: 12 },
    { n: 3, alt: 8 }, // "3" de uma tabela, letra pequena
    // o cabeçalho 3 não foi achado
    { n: 4, alt: 12 }, { n: 5, alt: 12 }, { n: 6, alt: 12 },
  ];
  assert.deepEqual(sequenciaDeCabecalhos(cands), [0, 1, 3, 4, 5]);
});

test('alternativas em grade viram trechos, na ordem do texto', () => {
  assert.deepEqual(trechosDeAlternativas('(A) 20. (B) 30. (C) 40.'), [
    { letra: 'A', texto: '(A) 20.' },
    { letra: 'B', texto: '(B) 30.' },
    { letra: 'C', texto: '(C) 40.' },
  ]);
  assert.deepEqual(trechosDeAlternativas('Considere (A) e (B).'), []);
  assert.equal(letraAntiga('(C) seguramente'), 'C');
  assert.equal(letraAntiga('C seguramente'), null);
});

test('texto WinAnsi lido como MacRoman (2002) é desfeito', () => {
  assert.equal(deMacRoman('As ·reas numeradas no gr·fico mostram a composiÁ„o'), 'As áreas numeradas no gráfico mostram a composição');
  assert.equal(deMacRoman('ìDe repente l· vinha'), '“De repente lá vinha');
  // caractere fora do MacRoman: o texto fica como está
  assert.equal(deMacRoman('x ≠ y → z'), 'x ≠ y → z');
});

test('marca d\'água "ENEM 2007" do rodapé, espaçada ou com letras dobradas', () => {
  assert.equal(marcaDagua('E N E M 2 0 0 7'), true);
  assert.equal(marcaDagua('EE NENN EEE MM 22 0200 000 66'), true);
  assert.equal(marcaDagua('O ENEM 2007 teve redação sobre o tema'), false);
});

test('texto de apoio de um grupo declarado', () => {
  assert.deepEqual(questoesDoApoio('Instruções: As questões de números 10 e 11 referem-se ao poema abaixo.'), [10, 11]);
  assert.deepEqual(questoesDoApoio('Texto para as questões 1 e 2'), [1, 2]);
  assert.deepEqual(questoesDoApoio('Observe nas questões 1, 2 e 3 o que foi feito'), [1, 2, 3]);
  assert.deepEqual(questoesDoApoio('Leia o texto para responder às questões de 21 a 23.'), [21, 22, 23]);
  assert.deepEqual(questoesDoApoio('O sol participa do ciclo da água'), []);
});

test('gabarito em PDF: pares, colunas de idioma e a tabela horizontal de 2006', () => {
  const g = gabaritoDoTexto(['Q1 C Q22 B Q43 B', '91 E B 137 A', 'Questão 1 2 3', 'Gabarito B D Anulada']);
  assert.equal(g.get(22), 'B');
  assert.deepEqual(g.get(91), { ingles: 'E', espanhol: 'B' });
  assert.equal(g.get(137), 'A');
  // a tabela horizontal sobrescreve a questão 1 com o valor dela
  assert.equal(g.get(1), 'B');
  assert.equal(g.get(3), 'ANULADA');
});

test('microdados: gabarito por código de prova, ignorando a linha cortada', () => {
  const csv = ['NU;CO_PROVA;TX_GABARITO_OBJETIVA', '1;A;CDB', '2;B;EEA', '3;A;CDB', '4;A;CD'].join('\n');
  const por = gabaritosPorProva(csv);
  assert.deepEqual([...por.get('A')], [['CDB', 2]]);
  assert.deepEqual([...por.get('B')], [['EEA', 1]]);
});

test('ITENS_PROVA: posição, gabarito e idioma por prova', () => {
  const csv = [
    'CO_POSICAO;SG_AREA;CO_ITEM;TX_GABARITO;CO_HABILIDADE;IN_ITEM_ABAN;TX_MOTIVO_ABAN;NU_PARAM_A;NU_PARAM_B;NU_PARAM_C;TX_COR;CO_PROVA;TP_LINGUA',
    '91;LC;1;B;1;0;;;;;Azul;111;0',
    '91;LC;2;C;1;0;;;;;Azul;111;1',
    '96;LC;3;X;1;0;;;;;Azul;111;',
  ].join('\n');
  assert.deepEqual(itensPorProva(csv).get('111'), [
    { pos: 91, gab: 'B', lingua: 'ingles' },
    { pos: 91, gab: 'C', lingua: 'espanhol' },
    { pos: 96, gab: 'ANULADA', lingua: null },
  ]);
});
