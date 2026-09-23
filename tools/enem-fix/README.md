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

`--dry` não escreve nada: serve para ver o relatório antes. Os PDFs são os
cadernos e gabaritos oficiais do INEP (`download.inep.gov.br`), nomeados como o
mapa `EXAMS` no topo de `build.mjs` espera.

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
