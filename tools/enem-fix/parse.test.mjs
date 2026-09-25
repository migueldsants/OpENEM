import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conv, fixSymbol, decodificaGid, SUP, SUB } from './parse.mjs';
import { lerGabarito } from './gabarito.mjs';

test('expoente vira sobrescrito, inclusive com traço no lugar do menos', () => {
  assert.equal(conv('8', SUP, '^'), '⁸');
  assert.equal(conv('23', SUP, '^'), '²³');
  // o caderno usa "–" (traço curto) como sinal de menos
  assert.equal(conv('–4', SUP, '^'), '⁻⁴');
  assert.equal(conv('2', SUB, '_'), '₂');
});

test('expoente que o caderno não resolve fica marcado, para virar imagem', () => {
  // o marcador é o sinal de que a alternativa precisa ser recortada da página
  assert.equal(conv('t/2', SUP, '^'), '^(t/2)');
});

test('fonte Symbol: os glifos da área privada viram o caractere de verdade', () => {
  assert.equal(fixSymbol('3  10'), '3 × 10');
  assert.equal(fixSymbol(''), '±');
  assert.equal(fixSymbol('texto normal'), 'texto normal');
});

test('fonte cujo código é o gid do Arial: "UHVVLJQL¿FDU" = "ressignificar"', () => {
  // No Arial o gid das letras é o código Unicode menos 29, e o gid 191 é a
  // ligadura "fi" — é daí que vem o "¿" no meio da palavra.
  const tabela = new Map();
  for (let gid = 0x21; gid <= 0x5d; gid++) tabela.set(gid, String.fromCharCode(gid + 29));
  tabela.set(0xbf, 'fi');
  assert.equal(decodificaGid('UHVVLJQL¿FDU', tabela), 'ressignificar');
});

test('o espaço que o pdfjs insere entre itens não é gid', () => {
  const tabela = new Map([[0x20, '='], [0x44, 'a']]);
  assert.equal(decodificaGid('D D', tabela), 'a a');
});

test('gabarito: número e letra são pareados pela altura na página', async () => {
  // fixture mínima: um PDF de uma página com duas linhas "1 C" e "2 D"
  const { PDFDocument, StandardFonts } = await import('pdf-lib');
  const { writeFileSync, mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([300, 200]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  // a letra fica um pouco mais alta que o número, como nos gabaritos reais
  page.drawText('1', { x: 40, y: 150, size: 12, font });
  page.drawText('C', { x: 120, y: 152, size: 12, font });
  page.drawText('2', { x: 40, y: 120, size: 12, font });
  page.drawText('D', { x: 120, y: 122, size: 12, font });
  const arq = join(mkdtempSync(join(tmpdir(), 'gab-')), 'gabarito.pdf');
  writeFileSync(arq, await pdf.save());

  const g = await lerGabarito(arq);
  assert.equal(g.get(1), 'C');
  assert.equal(g.get(2), 'D');
});
