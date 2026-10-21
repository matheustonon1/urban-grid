---
name: reactbits
description: Como buscar e adaptar componentes do React Bits (reactbits.dev — animações de texto, fundos animados, micro-interações, componentes animados) no Urban Grid sem quebrar a identidade visual nem inflar as dependências. Use quando o usuário citar React Bits / reactbits.dev, ou pedir animação de texto, fundo animado, efeito de cursor/hover, contador animado ou outra micro-interação que esse catálogo cobre — mesmo sem citar o nome da biblioteca.
---

# React Bits no Urban Grid

Catálogo de componentes React animados (categorias do site: Text Animations,
Animations, Components, Backgrounds, Micro Interactions). O código é "seu" depois de
copiado. **Antes de qualquer passo, leia** `.claude/skills/frontend-design/componentes-externos.md`
(regras de tokens, i18n, dark mode, movimento, onde não usar) e o `SKILL.md` de
`frontend-design`. Esta skill só cobre o que é específico do React Bits.

## Licença

MIT + **Commons Clause** (conferido no `LICENSE.md` do repositório oficial
`DavidHDev/react-bits`, 2026-10-21). Pode usar em aplicação/site/produto, inclusive
comercial. **Não pode** vender, sublicenciar ou redistribuir os componentes em si
(por exemplo, republicá-los como biblioteca ou kit). Num TCC que usa o componente
dentro do app, está dentro do permitido — só não republique o código copiado como se
fosse um pacote. Deixe a origem no comentário de cabeçalho do arquivo.

## Como obter o código (sem o CLI do shadcn)

Cada componente tem um registry item público em JSON, com o código e as dependências:

```bash
curl -s https://reactbits.dev/r/<Componente>-<TS|JS>-<TW|CSS>.json
```

Use sempre `TS-TW` (o projeto é TypeScript + Tailwind). Exemplo conferido:
`https://reactbits.dev/r/SplitText-TS-TW.json` → HTTP 200, um arquivo
(`SplitText/SplitText.tsx`, ~14,7k caracteres) e `dependencies`:
`gsap@^3.13.0`, `@gsap/react@^2.1.2`.

- O que importa no JSON: `files[].content` (o código) e `dependencies`.
- O nome é o do componente no site, em PascalCase. Se o `curl` der 404, peça o nome
  exato ao usuário. O código-fonte também está no repositório
  `DavidHDev/react-bits`, na pasta `src/ts-tailwind/` (a estrutura interna não foi
  conferida — abra a pasta antes de citar um caminho).
- **Não rode** `npx shadcn@latest add @react-bits/...`: o CLI pressupõe projeto
  shadcn (`components.json`, que não existe aqui) e o `init` mexe no CSS global.
  Pergunte antes se o usuário insistir nesse caminho.

## Dependências: o ponto mais caro

Muitos componentes puxam `gsap`, `motion`, `three` ou `ogl` (o `SplitText` acima já
traz `gsap` + `@gsap/react`). Leia `dependencies` **antes** de decidir:

1. O efeito é simples (fade/slide por palavra, contador, brilho no hover)? Reescreva
   em CSS com keyframes em `globals.css` e fique sem dependência nova.
2. O efeito precisa mesmo da biblioteca? Diga ao usuário o que entra no bundle e
   confirme antes de rodar `npm install`.
3. Fundos WebGL/canvas (Aurora, Silk, Galaxy e afins): `next/dynamic` com
   `ssr: false`, pausar fora da viewport, fallback estático com
   `prefers-reduced-motion`.

## Adaptar

- Muitas props de cor recebem hex. Passe os valores do tema (`--primary`, `--accent`
  e as variantes dark de `globals.css`), não os do exemplo, e troque junto com o tema.
- Texto vem por next-intl; o `text` do exemplo não fica no código.
- Tire do arquivo o que o projeto não usa (props, variantes, comentários de demo).

## Onde faz sentido aqui

Home (`src/app/page.tsx`), números de `transparencia` (contador em `font-mono
tabular-nums`), estados vazios, hover em cartões de reclamação. **Não** em
formulários, conta, moderação nem painéis (ver seção 4 de `componentes-externos.md`).

## Fluxo

1. Entender o efeito e onde ele entra; checar se CSS puro resolve.
2. `curl` do registry item e leitura de `dependencies`.
3. Enxugar e traduzir pro vocabulário do projeto.
4. Comentário de cabeçalho: `// Adaptado de React Bits (<URL do componente>), MIT + Commons Clause.`
5. Checklist de `frontend-design`, screenshot real em claro/escuro/375px, `tsc`,
   `eslint`, testes.
