# tabela-periodica — o catálogo da tela Tabela periódica

Gera `openem_frontend/src/data/elementos.json`, **versionado**, a partir das
fontes primárias. As fontes baixadas ficam em `fontes/`, fora do git.

O JSON **nunca é editado à mão**: mexa no roteiro (ou em `nomes.json`,
`quimica.json` e `divergencias.json`), rode `montar.mjs` e depois
`verificar.mjs`, que confere cada valor contra uma segunda fonte e precisa
fechar com **0 divergências não explicadas**. `src/data/elementos.test.ts`, no
frontend, trava a estrutura.

## Uso

Precisa de Node ≥ 22.13 (o `node:sqlite`, para ler o banco do mendeleev). Não
tem dependências.

```bash
node tools/tabela-periodica/baixar.mjs        # baixa as fontes para fontes/ (e anota a data)
node tools/tabela-periodica/montar.mjs        # grava o catálogo
node tools/tabela-periodica/verificar.mjs     # confere contra a segunda fonte
node tools/tabela-periodica/verificar.mjs --todas  # lista também as explicadas
```

A data mais recente de `fontes/baixado-em.json` vira o "Dados conferidos em"
da tela. Quando a CIAAW ou a IUPAC revisarem algo, ou um elemento novo for
confirmado, basta rodar os três de novo.

## De onde vem cada campo

| Campo | Fonte | Segunda fonte (verificar.mjs) |
| --- | --- | --- |
| Símbolo, nome em inglês | CIAAW | PubChem |
| Nome em português | `nomes.json` (grafia da tabelaperiodica.org; 113, 115, 117 e 118 pela Pesquisa FAPESP) | lista da tabelaperiodica.org |
| Massa padrão (valor, incerteza, intervalo) | CIAAW, Standard Atomic Weights 2024 | NIST, Atomic Weights and Isotopic Compositions |
| Massa abreviada | CIAAW, Abridged Standard Atomic Weights 2024 | PubChem |
| Isótopo de vida mais longa e meia-vida | CIAAW, Radioactive Elements (Bi, Th, Pa e U pela IAEA) | IAEA LiveChart |
| Radioativo | IAEA (sem nuclídeo estável) | mendeleev |
| Isótopos naturais e abundância | NIST | IAEA |
| Configuração eletrônica | NIST ASD (1–108); PubChem, marcada como prevista (109–118) | PubChem e mendeleev |
| Energia de ionização | NIST ASD | PubChem |
| Eletronegatividade (Pauling) | PubChem | mendeleev |
| Raio covalente | Pyykkö e Atsumi 2009, pelo mendeleev | Cordero 2008, pelo mendeleev (ordem de grandeza) |
| Afinidade eletrônica | CRC, pelo mendeleev; At pela medida de 2020; sem ânion estável pela Andersen 2004 | PubChem |
| Estados de oxidação | PubChem; os comuns pelo mendeleev | mendeleev |
| Densidade, fusão, ebulição | PubChem | mendeleev (CRC) |
| Categoria | PubChem | mendeleev |
| Posição (período, grupo, bloco) | calculada pela tabela da IUPAC de 2022 | mendeleev |
| Estado a 25 °C | calculado dos pontos de fusão e ebulição | PubChem |
| Natural ou sintético | regra do roteiro (Z ≤ 92, menos Tc e Pm) | — |
| Texto de química | `quimica.json`, redação do OpENEM | — |

O mendeleev (MIT) entra como segunda fonte e em três campos (raio,
afinidade e estados comuns), sempre citado. Nada vem da Wikipedia nem de
tabela comercial: os textos de `quimica.json` são do projeto.

## Regras

- **Valor desconhecido fica `null`** e a tela diz "desconhecido". Estimativa só
  entra marcada (`estimado`), e as listas de `montar.mjs` dizem por que cada
  uma é estimada.
- **Previsto** (configuração a partir do 104, categoria e estados de oxidação
  a partir do 109) vem marcado no dado e na tela.
- **Hélio, carbono e arsênio** não têm ponto de fusão a 1 atm: o hélio não
  solidifica e os outros dois sublimam (`semFusao`). O valor do PubChem para
  eles é sob pressão.
- **Grupo 3:** o roteiro segue a tabela oficial da IUPAC, com os 15
  lantanídeos e os 15 actinídeos na faixa f e o marcador na casa do grupo 3.
  A tela explica o debate (La/Ac ou Lu/Lr).
- **Nomes 113, 115, 117 e 118:** nihônio, moscóvio, tennessino e oganessono,
  como a Pesquisa FAPESP noticiou a recomendação da IUPAC; as outras grafias
  (nipônio, tenesso, oganessônio) ficam em `variantes`, que a busca encontra.
- **Divergências** entre a fonte e a segunda fonte vão para
  `divergencias.json` com o motivo (fonte desatualizada, outra convenção,
  valor estimado…). Explicação que não corresponde mais a nada também derruba
  a verificação.
