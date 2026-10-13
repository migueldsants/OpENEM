# redacao — propostas de redação do ENEM, a partir dos cadernos oficiais

Gera o catálogo da tela **Redações** do app: tema, proposta, textos
motivadores e fac-símile da página, de 1998 a 2025 (aplicação regular,
PPL/reaplicação, ENEM Digital 2020, 2ª aplicação de 2016, 3ª de 2014 e a
aplicação de Belém em 2025).

Saídas, **versionadas**:

- `openem_frontend/src/data/redacoes.json` — temas, textos e fontes;
- `openem_frontend/public/redacoes/*.webp` — figuras recortadas e o
  fac-símile de cada página (`<id>-pagina.webp`).

Os PDFs (`pdfs/`) e as prévias (`paginas/`) **não** são versionados.

## Regra da casa: reproduzir, nunca reescrever

São documentos oficiais de prova. O texto sai sempre do PDF; o roteiro só diz
**onde** está cada coisa. Não se corrige, resume, moderniza ortografia nem se
inventa rótulo (até 2013 o caderno não numera os textos, então o app também
não). A grafia do tema é a do caderno, inclusive as maiúsculas. Em caso de
divergência vale o caderno do INEP, que a tela sempre linka.

O que foge disso está marcado no próprio dado e aparece na tela:

- **PPL 2021** usa o caderno 4 (rosa): os cadernos 1 e 3 têm fontes que nenhum
  renderizador desenha. O texto vem da cópia consertada pelo `fixfonts.mjs`.
- **2008** não tem frase-tema no caderno: `tema` fica vazio (`semTema`) e a
  tela mostra o próprio comando, sem título inventado.
- **Versalete.** Onde a página imprime em maiúsculas com fonte versalete e o
  PDF guarda minúsculas, `maiusculas` devolve a caixa impressa (tema de 2011,
  título do Texto IV de 2015).
- **1998** tem o Texto I em fonte com mapeamento ilegível no PDF (o render visual
  é legível, mas o MuPDF não extrai Unicode correto). Entra como imagem recortada
  da caixa da letra; o `alt` transcreve o trecho para leitores de tela.
- **2008 e 2009** trazem os textos como imagem no PDF: entram como figura.
- A descrição (`alt`) das figuras é nossa, para leitor de tela. Não faz parte
  do documento e não substitui a figura.
- ENEM Digital de 2021 e 2022 usou a mesma proposta da prova impressa e não
  é repetido (`pular`).

## Uso

```bash
node redacao/baixar.mjs          # baixa os cadernos listados em fontes.json
node redacao/localizar.mjs       # acha a página da proposta em cada caderno
node redacao/despejar.mjs [id…]  # blocos de texto/imagem da página + prévia PNG
node redacao/montar.mjs          # grava o catálogo e as figuras
node redacao/montar.mjs --ver ID # mostra o rascunho de um caderno, sem gravar
node redacao/montar.mjs --hifens # lista palavras juntadas, para conferência
node redacao/conferir.mjs        # folhas de contato com todas as figuras
node redacao/blocos.mjs ID       # lista os blocos (para escrever o roteiro)
node redacao/linhas.mjs ID N…    # linhas de blocos específicos
node redacao/achar.mjs TERMO ID… # em que páginas um termo aparece
```

Depois de mexer no roteiro, rode `montar.mjs`, olhe as folhas de contato
(`paginas/folha-N.png`) e rode `npm test` no frontend:
`src/data/redacoes.test.ts` trava a estrutura do catálogo.

## Roteiro (`roteiro/*.json`)

Um objeto por caderno; os lotes são lidos em ordem e os posteriores completam
os anteriores. Sem `textos`, vale a leitura automática (colunas, rótulos
`TEXTO I`, fonte por tamanho de letra), ajustada por `figuras`, `alts`,
`tipos`, `versos` e `semTitulo`. Com `textos`, cada item aponta os blocos:

```json
{ "r": "II", "i": [["titulo", 9], ["p", 10, "11:0-3"], ["img", { "p": 2, "box": [78, 445, 503, 580], "alt": "…" }], ["fonte", 14]] }
```

- `"11:0-3"` pega as linhas 0 a 3 do bloco 11;
- `p` abre parágrafo a cada bloco, recuo ou salto; `pj` junta tudo num só;
- `cap` é parágrafo com capitular (a letra grande vem solta no PDF);
- `lit` é texto que o PDF só tem como imagem e foi lido da página — usado
  apenas para referência bibliográfica e título, nunca para o corpo;
- `corrigir` repõe uma linha que o PDF devolve ilegível, lida da página.

## Negrito e itálico

Vêm do PDF, caractere a caractere (`despejar.mjs`), e chegam ao catálogo como
`partes` (`{ t, b?, i? }`), ao lado do `texto` liso. Juntando as partes dá
exatamente o `texto` — o teste do frontend trava isso.

## Verificação contra um segundo extrator

```bash
node redacao/verificar.mjs            # tem de terminar com 0 divergências
node redacao/verificar.mjs --sobras   # o que a página tem e o catálogo não
```

O catálogo é montado com o MuPDF; o `verificar.mjs` relê cada página com o
pdf.js e exige que todo bloco do catálogo exista lá com a mesma sequência de
caracteres (só espaço e hífen de quebra são ignorados) e que o tema apareça no
comando com a mesma grafia. Foi essa conferência que pegou o comando de 2010 a
2013 vindo com texto a mais. Os poucos blocos que os dois extratores não
conseguem confirmar (versalete, acentos de 2002 no pdf.js, página em imagem)
estão listados em `CONFERIDOS_NA_IMAGEM`, cada um com o motivo, e foram
conferidos a olho contra a página. Rode sempre depois do `montar.mjs`.

## Duas conferências que evitam alterar o texto

- **Hífen no fim da linha.** Juntar `re-` + `presentantes` é certo; juntar
  `colocá-` + `los` apagaria um hífen de verdade. Toda junção é listada por
  `--hifens`, e os compostos reais ficam em `hifens.json`.
- **Ligaduras** (`fi`, `fl`) dos PDFs consertados voltam com um espaço no meio
  (`ofi cialmente`); a mesma listagem mostra o que foi juntado.
