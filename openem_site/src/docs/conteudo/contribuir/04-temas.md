---
titulo: Temas de cor
descricao: Como criar uma família de temas de cor no OpENEM, os três arquivos que ela toca, os testes de contraste e o formato do tema personalizado.
---

## Como os temas funcionam

Cada família de tema tem um lado claro e um escuro, aplicados como `data-theme="<familia>-light"` ou `data-theme="<familia>-dark"` no `<html>`. As cores são propriedades CSS definidas em `openem_frontend/src/themes.css`, que o `index.css` importa.

- Os seletores `[data-theme=...]` valem em qualquer elemento, não só no `<html>`: a galeria da tela Temas mostra a prévia de cada paleta com um `<div data-theme>`.
- O script `public/theme-boot.js` aplica o tema salvo antes da primeira pintura, para a tela não piscar na cor errada. Ele é um arquivo, e não um script inline, porque a CSP do nginx só aceita script da própria origem.
- O `default` (vermelho) é a base, também aplicada em `:root`. Ele não se mexe.

## Os três lugares de uma família nova

### 1. O bloco no themes.css

Dois seletores, um por lado, cada um com os 10 tokens de cor em `#rrggbb`:

```css
[data-theme='mar-light'] {
  color-scheme: light;
  --bg: #......;
  --sidebar: #......;
  --surface: #......;
  --surface-2: #......;
  --fg: #......;
  --muted: #......;
  --line: #......;
  --brand: #......;
  --brand-2: #......;
  --brand-ink: #......;
}
[data-theme='mar-dark'] {
  color-scheme: dark;
  /* os mesmos 10 tokens */
}
```

`mar` é um nome de exemplo. Os blocos existentes também definem `--shadow` e `--glow`; use um deles como modelo.

### 2. FAMILIES em src/theme.tsx

Acrescente a chave ao tipo `ThemeFamily` e uma entrada em `FAMILIES`, com `key`, `label` (o nome que o aluno vê) e `group`, que decide a seção da galeria: `classicos`, `criativos`, `oled` ou `acessibilidade`.

### 3. A lista do theme-boot.js

Acrescente a chave à lista `families` de `openem_frontend/public/theme-boot.js`. O script não pode importar nada, por isso repete a lista.

A chave precisa ter só letras minúsculas: o boot lê o tema salvo com o padrão `<letras>-light` ou `<letras>-dark`, e um valor desconhecido cai no `default`.

> **Dica:** o site da documentação usa o mesmo `theme-boot.js` e o mesmo CSS do app, então a família nova aparece nele sem cópia de arquivo.

## Os testes que seguram os três

`src/theme-boot.test.ts` confere que a lista do boot tem exatamente as mesmas chaves de `FAMILIES`, que cada tema salvo é aplicado antes da pintura e que o `index.html` não tem script inline.

`src/theme-palettes.test.ts` lê o CSS e confere, para cada lado de cada família:

| Verificação | Mínimo | Sobre |
| --- | --- | --- |
| Os 10 tokens definidos em `#rrggbb` | | |
| Texto principal (`fg`) | 7:1 | `bg`, `surface`, `surface-2` e `sidebar` |
| Texto suave (`muted`) | 4,5:1 | `bg`, `surface`, `surface-2` e `sidebar` |
| Texto sobre a marca (`brand-ink`) | 4,5:1 | `brand` |
| Marca (`brand`) | 3:1 | `bg`, `surface` e `surface-2` |
| Cores das áreas (`mat`, `nat`, `hum`, `lin`, `red`, `danger`) | 4,5:1 | `bg`, `surface` e `surface-2` |

As cores das áreas não são da família: vêm do `index.css`, um conjunto para o lado claro e outro para o escuro. As superfícies da família nova precisam respeitar as duas.

```bash
cd openem_frontend
npm test -- theme
```

## Efeitos dos temas criativos

Alguns temas criativos mudam cantos e fonte de destaque por tokens (`--radius-*` e `--font-display`): Cyberpunk e Terminal ficam com cantos retos e títulos em fonte mono, e Sakura com cantos bem redondos. No `themes.css`, os lados escuros de Cyberpunk, Synthwave e Terminal ganham brilho no botão principal, e os de Cyberpunk e Terminal também scanlines. Esses efeitos são decoração: somem com `html[data-fx='off']`, ligado pela chave "Efeitos visuais" da tela Temas, e com a preferência do sistema `prefers-contrast: more`.

## O tema personalizado

O aluno monta o próprio tema a partir de uma cor. A paleta dos dois lados é gerada por `src/lib/theme-derive.ts`, sobre `src/lib/color.ts` (OKLCH e contraste WCAG), e aplicada como `custom-light` ou `custom-dark`.

O tema fica no `localStorage`, na chave `openem.theme.custom`, no formato v2:

```json
{
  "v": 2,
  "id": "opcional, id do tema salvo no servidor",
  "name": "Meu tema",
  "light": { "bg": "#f5f1f6", "brand": "#d91748" },
  "dark": { "bg": "#15111c", "brand": "#ff5a7d" }
}
```

Cada lado leva os mesmos 10 tokens; o exemplo mostra só dois. O formato antigo, com um lado só, é migrado na leitura: o lado é escolhido pela luminância do fundo.

### Só #rrggbb

As cores vão para `style.setProperty`, e um tema publicado na comunidade roda no navegador de outros alunos. Por isso só `#rrggbb` passa: um `url(...)` vazaria o IP de quem abre o tema, e `var()` e afins abririam espaço para injeção de CSS. O backend valida em `src/common/theme-tokens.ts`, e o frontend e o `theme-boot.js` validam de novo antes de aplicar.

No backend, o módulo `themes` guarda os temas do aluno: o tema nasce privado e a publicação é opcional, cada aluno curte um tema publicado uma vez (curtir de novo desfaz), ninguém curte o próprio tema, e editar ou apagar o tema de outro aluno responde 404.

## E o PDF?

As paletas dos cadernos em PDF ficam em `openem_backend/src/common/pdf/themes.ts` e não acompanham as famílias novas: um tema que não está lá cai no `default`. Uma família nova não exige mudança no backend, mas o PDF só terá as cores dela se você acrescentar uma paleta nesse arquivo.
