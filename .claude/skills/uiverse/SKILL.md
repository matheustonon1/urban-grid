---
name: uiverse
description: Como trazer elementos do Uiverse (uiverse.io — botões, loaders, toggles, checkboxes, inputs, cards em CSS ou Tailwind) para o Urban Grid, transformando vitrine em componente real, acessível e com os tokens do projeto. Use quando o usuário citar Uiverse / uiverse.io, colar HTML/CSS de um elemento de lá, ou pedir loader, spinner, switch/toggle, checkbox customizado ou botão com efeito — mesmo sem citar o site.
---

# Uiverse no Urban Grid

Biblioteca de elementos de UI open source (botões, loaders, cards, toggles,
checkboxes, inputs, forms), cada um com "Get code" em CSS ou Tailwind. **Antes de
qualquer passo, leia** `.claude/skills/frontend-design/componentes-externos.md` e o
`SKILL.md` de `frontend-design`. Esta skill cobre só o que é específico do Uiverse.

## O código não dá pra buscar sozinho

O site responde **HTTP 403** a acesso automatizado (conferido em 2026-10-21 na home e
numa página de elemento). Não perca tempo com `WebFetch`/`curl`: **peça ao usuário que
cole o código** do elemento (aba Tailwind, de preferência). Não encontrei CLI nem MCP
oficial; se existir, o usuário diz.

## Licença

É **por elemento**. As páginas costumam mostrar um aviso de licença (vi MIT numa
delas, via busca; o 403 impediu confirmar direto no site), e há elementos derivados de
outros projetos (um exemplo citava o Flowbite) — nesse caso vale também a licença do
original. Fontes de terceiros dizem que o repositório do Uiverse é MIT, mas isso não
substitui o aviso da página. Regra: **sem aviso de licença no que o usuário colou, pergunte
antes de copiar**; com aviso, leve autor e licença para o cabeçalho:
`// Adaptado de Uiverse (<URL>), por <autor>, licença <X>.`

## Da vitrine pro componente

Elementos do Uiverse são feitos para impressionar numa galeria, não para um formulário
real. Costumam vir com `<div>` no lugar de botão, sem foco visível nem teclado, sem
`<label>`, cor e tamanho fixos, animação infinita e texto em inglês. Converta:

- **Semântica**: `<button type>`, `<input>` com `<label htmlFor>`, `disabled`,
  `focus-visible`. Em switch/checkbox customizado, mantenha o `<input>` nativo
  (`sr-only`, não `display:none`) atrás de um `<label>` estilizado — é o padrão já
  usado em `reclamacoes/nova/form.tsx` (`imagens-input`).
- **JSX**: `class` → `className`, `for` → `htmlFor`, `style="..."` → objeto,
  tags de auto-fechamento.
- **Versão Tailwind** > versão CSS. Se só houver CSS, converta para utilitários; os
  `@keyframes` que sobrarem vão para `globals.css` com nome próprio e entram na lista
  de `prefers-reduced-motion` (ver `componentes-externos.md`, seção 3).
- **Cores e medidas**: tokens do projeto e par claro/escuro; `px` fixo vira escala do
  Tailwind. Glow/neon e sombra colorida vão de encontro ao `frontend-design` — reduza.
- **Texto**: next-intl, nas duas línguas.

## Onde encaixa neste projeto

Candidatos naturais (não implemente sem o pedido):

- **Loader/spinner** no estado `pending` dos botões de Server Action — hoje o projeto
  não tem nenhum loader (só `disabled`).
- **Switch** no lugar do checkbox de "Preferências de notificação" em
  `painel/conta/formularios.tsx`, mantendo o `<input type="checkbox">` por baixo.
- Estados vazios e skeletons.

Evite botões chamativos (glow, gradiente animado) nos fluxos principais — conta,
login, nova reclamação, moderação — conforme a seção 4 de `componentes-externos.md`.
