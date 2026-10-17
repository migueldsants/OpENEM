# enem-fix — conserta o dataset do ENEM a partir dos cadernos oficiais

O import do OpENEM (`npm run db:import:enem`) usa o dataset estático do
[updated-enem-api](https://github.com/migueldsants/updated-enem-api). Esse
dataset foi extraído dos PDFs do INEP e traz defeitos herdados dessa extração:

- questões **sem o texto das alternativas** — quase todas as reaplicações de
  2017, 2020, 2021 e 2025;
- enunciados **ilegíveis** em 2017 e 2021 (reaplicação), por causa de fontes
  cujo PDF não declara o mapeamento para Unicode;
- **fórmulas viradas texto solto** (`C T P T P A B = ⋅ 2 4`), espalhadas por
  todas as provas;
- **gabarito errado** nas questões de espanhol, que repetem a letra do inglês;
- **questões que faltam** — a pasta da questão simplesmente não existe.

Questão sem alternativa é recusada pelo import de propósito, porque não dá para
respondê-la. Esta ferramenta refaz essas questões a partir do caderno oficial.

## Uso

```bash
npm install
# 1. conserta as fontes dos cadernos (sem isso, 2017 e 2021 saem ilegíveis)
node fixfonts.mjs <caderno>.pdf <caderno>_fix.pdf
# 2. refaz as questões com defeito no dataset
node build.mjs <dataset/public> <pasta dos PDFs> [--dry] [--only=2021-reaplicacao]
# 3. confere o resultado
node auditar.mjs <dataset/public>
# 4. confere, questão a questão, o banco importado contra o gabarito oficial
node verificar-gabaritos.mjs <pasta dos PDFs> [url do banco]
npm test
```

`--dry` não escreve nada: serve para ver o relatório antes.

### Provas que o dataset não tem

`criar.mjs` monta do zero, a partir do caderno e do gabarito oficiais, as
provas que nem existem no dataset: as reaplicações/PPL de 2012 a 2016, a 3ª
aplicação de 2014, a 2ª aplicação de 2016, o ENEM Digital (2020–2022) e a
aplicação de Belém, Ananindeua e Marituba (2025). A lista, com o caderno e o
gabarito de cada dia, fica em `provas-novas.json`.

```bash
node criar.mjs <dataset/public> <pasta dos PDFs> [--dry] [--only=2016-reaplicacao] [--saida=<pasta>]
# validação do próprio extrator: recria uma prova que o dataset já tem e compara
node criar.mjs <dataset/public> <pasta dos PDFs> --only=2016 --comparar=2016 --saida=/tmp/validacao
```

A questão só entra com cinco alternativas, gabarito oficial (anulada fica de
fora), diagramação dentro do padrão e texto sem resíduo de extração; o resto
vai para o relatório como pendência. A área sai da posição no caderno, como
no import. Na última validação (ENEM 2016, refeito do zero e comparado com o
dataset): 182 das 185 questões refeitas, gabarito 181/181, texto 177/181 —
as diferenças restantes são questões em que o dataset traz o enunciado como
imagem e o caderno tem texto.

Os PDFs são os cadernos e gabaritos oficiais do INEP (`download.inep.gov.br`),
nomeados como o mapa `EXAMS` no topo de `build.mjs` espera.

### ENEM de 1998 a 2008 e PPL de 2010 e 2011

A página de provas do INEP traz só o caderno dessas provas, sem gabarito. O
gabarito oficial existe, mas dentro dos **microdados** do próprio INEP
(`download.inep.gov.br/microdados/microdados_enem_<ano>.zip`), e
`gabaritos-antigos.mjs` o tira de lá sem baixar os zips (de 25 MB a 630 MB):
lê por HTTP Range só o diretório do zip e as entradas que interessam
(`zip-remoto.mjs`).

- **1998–2008:** cada linha dos microdados traz o gabarito da prova do aluno
  (`TX_GABARITO_OBJETIVA`, pela cor em `CO_PROVA`), e a pasta "PROVAS E
  GABARITOS" do zip traz o gabarito da prova amarela em PDF. As duas fontes
  são conferidas uma contra a outra e batem nas 63 questões de todos os anos.
  O PDF de 2008 é imagem e foi conferido à mão; o de 2004 vem no zip com o
  nome de 2005, e o script confere o ano pelo título.
- **PPL 2010 e 2011:** `ITENS_PROVA_<ano>.csv` traz o gabarito item a item por
  código de prova. A PPL de 2010 (a "2ª aplicação" dos microdados, o mesmo
  arquivo do caderno publicado como PPL) é conferida com o gabarito gravado nas
  linhas dos alunos; a de 2011, com o PDF de gabarito da PPL que vem no zip.
  Onde as duas fontes oficiais discordam (2011, espanhol 92 e 93), a questão
  fica sem gabarito e fora do dataset.

```bash
node gabaritos-antigos.mjs          # grava gabaritos-antigos.json
node criar.mjs <dataset/public> <pasta dos PDFs> --only=1998,2010-reaplicacao --saida=<pasta>
```

O caderno antigo tem outro desenho, e o parser o lê com `{ antigo: true }`
(`antigo` em `provas-novas.json`):

- **63 questões num caderno só**, sem as quatro áreas: a questão sai com
  `discipline: null` (`semAreas`).
- **Cabeçalho de cada ano:** "03 O texto..." (1998/1999, o número colado ao
  enunciado), o número solto (2000–2003, 2005), "1." (2004) e "Questão 1"
  (2006–2008). O que separa o cabeçalho de um número qualquer é a sequência
  1, 2, 3... — a capa traz as instruções numeradas de 1 a 12, e é a altura da
  letra que as separa (`sequenciaDeCabecalhos`).
- **Alternativas "(A)"**, às vezes em grade, várias por linha.
- **Texto de apoio compartilhado:** vem antes do número da primeira questão do
  grupo, e cada questão do dataset recebe uma cópia — pelo grupo declarado ("As
  questões 10 e 11 referem-se ao poema") ou, com `apoioImplicito`, quando a
  questão seguinte só tem um comando curto ("O texto mostra..."). Cada herança
  vai para os avisos do relatório; as que não valem ficam em `semApoio`.
- **Página mista:** a 4 e a 5 lado a lado embaixo da 3, que ocupa a largura
  toda; a coluna da direita começa no cabeçalho dela, não no meio da página.
- **Defeitos de fonte:** texto WinAnsi que o pdfjs lê como MacRoman (2002:
  "gr·fico"), título em negrito falso desenhado duas vezes (2007, sai como
  imagem) e a marca d'água "ENEM 2007" do rodapé.

Na última rodada: 645 de 693 questões antigas, 177 de 185 na PPL de 2010 e 176
de 185 na de 2011. O resto está no relatório: alternativas que são só imagem
(sem letra no texto), diagramação fora do padrão e as duas questões de 2011 com
gabarito em disputa.

## Como cada defeito é consertado

**Texto.** `parse.mjs` lê o caderno com o `pdfjs`, agrupa os itens em linhas e
colunas pelas coordenadas e separa enunciado, comando e alternativas.

**Fontes sem mapeamento.** Em 2017 e 2021 o PDF não diz que caractere cada
glifo representa, e o texto sai como `UHVVLJQL¿FDU` (é "ressignificar"). Há dois
casos: quando a fonte declara os nomes dos glifos (`/Differences` com `gNN`),
`fixfonts.mjs` reescreve esses nomes para `uniXXXX` usando a numeração do Arial
do Windows; quando o próprio código do caractere é o número do glifo,
`parse.mjs` decide por fonte, comparando quanto do texto vira palavra conhecida
antes e depois de decodificar.

**Diagramações diferentes.** O parser reconhece página de coluna única (o
texto atravessa o vão do meio), a letra da alternativa pela fonte dela (o
artigo "A" no começo de uma linha justificada não é alternativa), a prova
digital (uma questão por página, letra num círculo, alternativa num
retângulo branco ou cinza-claro, cartão com sombra em volta da questão),
número de gabarito quebrado em dois itens ("12" + "1") e a ligadura "fi"/"fl"
devolvida com espaço ("difi cultando"). Desenho que não aparece na página
(caminho de recorte, preenchimento branco) não conta como figura.

**Fórmula, gráfico e figura.** O que não vira texto limpo é recortado da página
como imagem (`render.mjs`, via MuPDF). Entram nessa regra: alternativa com
figura, com barra de fração, com radical (um traço vetorial curto no meio do
texto) ou cujo texto tem resíduo de fonte. Parágrafo do enunciado com fórmula
também vira imagem.

**Gabarito.** `gabarito.mjs` lê a resposta pelas coordenadas, e não pelo texto
linearizado. Isso importa por dois motivos reais: em 2015 as colunas de número e
letra estão desalinhadas na vertical, e a leitura por texto pareia cada letra
com a questão seguinte; em 2009 o gabarito traz quatro cadernos lado a lado, e
cada caderno tem uma ordem de questões diferente — ler a coluna errada devolve o
gabarito de outra prova.

## As duas travas que evitam estragar o dataset

Casar a questão errada é pior que deixá-la quebrada, então:

1. **Numeração.** A ordem das questões muda de um caderno para outro. Antes de
   usar o caderno, o build confere que a numeração bate com a do dataset, pelo
   texto das questões íntegras e pelo gabarito.
2. **Gabarito.** A resposta oficial só substitui a do dataset quando a leitura
   concorda com ele em pelo menos 90% da prova. Discordância grande significa
   coluna errada (fica perto de 50%); erro pontual do dataset fica acima de 95%.

Questão que não passa nessas travas — ou cuja diagramação o extrator não lê bem
— fica de fora e é listada como pendência, em vez de entrar errada.

## Verificação

`verificar-gabaritos.mjs` compara a resposta certa de cada questão do banco com
o gabarito oficial, prova por prova. Na última execução: **4187/4187 conferem**.
O que fica de fora são as provas sem gabarito publicado pelo INEP (2010, a
reaplicação de 2018 e o 1º dia da reaplicação de 2017) e as questões anuladas.

## Limites conhecidos

- Questão **anulada** pelo INEP fica fora: sem resposta certa, o import recusa.
- Alternativas em grade (duas colunas) e páginas em coluna única não são lidas.
- 2010 e a reaplicação de 2018 não têm gabarito publicado pelo INEP; nessas
  provas o gabarito do dataset é mantido como está.
- As imagens recortadas saem em PNG a 3x, o que é legível mas não é o vetor
  original.
