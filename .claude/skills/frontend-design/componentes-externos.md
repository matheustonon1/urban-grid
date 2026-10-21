# Trazendo componentes de fora pro Urban Grid

Vale pra React Bits, 21st.dev, Uiverse e qualquer outro catálogo de "copie e cole".
O código que entra vira **código do projeto**: tem que parecer escrito aqui, não
colado de lá. Identidade visual (fontes, paleta, tiques a evitar) continua sendo a
do `SKILL.md` desta pasta — esta página só cobre o que muda quando o código nasceu
em outro lugar.

## 1. Antes de instalar qualquer coisa

- Abra o `package.json` e veja o que já existe. No momento em que isto foi escrito
  **não há** `motion`/`framer-motion`, `gsap`, `three`, `ogl`, `shadcn`, `clsx`,
  `tailwind-merge`, `class-variance-authority` nem Radix — só `lucide-react` pra
  ícones. Confirme antes de assumir; a lista pode ter mudado.
- Cada dependência nova precisa de motivo. Ordem de preferência: CSS puro (keyframes
  em `globals.css`) → utilitários Tailwind → biblioteca. Se um componente trouxer
  `gsap` ou `three` por causa de um efeito pequeno, reescreva o efeito.
- **Não rode `shadcn init`** nem comandos que dependam dele sem perguntar. Este
  projeto não tem `components.json` nem `src/lib/utils.ts` (`cn`), e o `init` costuma
  reescrever o CSS global com tokens próprios (`--primary`, `--background`…) que
  colidem com os do projeto.

## 2. Traduzir pro vocabulário do projeto

- **Cores**: só tokens (`primary`, `accent`, `background`, `foreground`) e a escala
  `slate-*`. Nada de hex solto, nem `gray`/`zinc`/`neutral` puros misturados.
- **Dark mode**: variante `dark:` — no projeto é a classe `.dark` no `<html>`
  (`@custom-variant dark` em `globals.css`), não `prefers-color-scheme`. Toda cor
  nova precisa do par claro/escuro.
- **Estilos prontos**: use `botaoPrimario`, `botaoSecundario`, `campoInput`, `cartao`
  etc. de `src/lib/estilos.ts` em vez de colar o botão/cartão do catálogo. Se a
  variante nova merece existir, vira constante nesse arquivo.
- **Fontes**: nunca importe a fonte do exemplo. `font-display`, `font-sans`,
  `font-mono` (números e dados em `font-mono tabular-nums`, como no resto do site).
- **Tailwind v4**: não há `tailwind.config`. Keyframes e tokens novos vão em
  `src/app/globals.css`, junto de `fade-in`, `pop-in`, `float`…
- **Texto**: nada de string literal ("Click me", "Get started"). Tudo por next-intl,
  com a mesma chave em `messages/pt-BR.json` **e** `messages/en.json`. Conteúdo de
  demonstração é sempre do domínio (buraco na rua, poste apagado), nunca lorem ipsum.
- **Ícones**: `lucide-react`.
- **Next.js**: hook, evento ou animação em JS exige `"use client"`. Este Next tem
  quebras em relação ao que você conhece — leia o guia relevante em
  `node_modules/next/dist/docs/` antes de escrever (ver `AGENTS.md`). Canvas/WebGL:
  `next/dynamic` com `ssr: false`, dentro de um Client Component.

## 3. Movimento e acessibilidade

- O bloco `@media (prefers-reduced-motion: reduce)` de `globals.css` é uma **lista
  fixa** de classes `.animate-*`. Animação nova não entra sozinha: adicione a classe
  lá. Efeitos em JS (gsap, canvas, `requestAnimationFrame`) precisam checar
  `matchMedia("(prefers-reduced-motion: reduce)")` e cair num estado estático.
- Pausar o que está fora da tela; nada de animação infinita em elemento que a pessoa
  precisa ler ou preencher.
- Elemento interativo é elemento semântico: `<button>`, `<a>`, `<input>` com
  `<label>` — não `<div onClick>`. Foco visível, teclado, `aria-*`, `disabled`.
- Contraste conferido nos **dois** temas. Animação nunca é o único portador da
  informação.

## 4. Onde usar e onde não

Urban Grid é plataforma cívica: a pessoa está registrando um problema ou cobrando
resposta. O visual deve passar confiança, não espetáculo.

- **Pode**: landing, estados vazios, números de destaque (`transparencia`), loaders,
  micro-interações de hover/pressionar.
- **Evite**: formulários (nova reclamação, conta, login/cadastro), moderação, painéis
  de órgão e admin, qualquer fluxo de segurança (2FA, senha, exclusão). Efeito
  chamativo ali compete com a tarefa.
- Fundo animado em gradiente/aurora é o tique clássico de "site feito por IA" da lista
  do `SKILL.md`. Só com decisão consciente, uma vez, num ponto de destaque.

## 5. Licença e atribuição

A licença é **por componente**, não por site. No topo de todo arquivo copiado, um
comentário com: URL de origem, autor e licença. Se a página do componente não
declarar licença, trate como referência de design e reescreva em vez de copiar. As
notas específicas de cada fonte estão na skill dela.

## 6. Antes de dar por pronto

- Enxugue: remova demo, props não usadas e variantes que ninguém chama.
- Checklist do `SKILL.md` desta pasta (claro e escuro, 375px, tiques genéricos).
- Veja renderizado de verdade (screenshot real) e rode `tsc`, `eslint`, `vitest` e,
  se mexeu em fluxo interativo, o E2E correspondente.
- Se entrou dependência nova, rode `npm run build` e confira se ela não inflou a rota
  que a usa.
