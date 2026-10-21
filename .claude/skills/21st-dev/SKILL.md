---
name: 21st-dev
description: Como usar o 21st.dev (catálogo comunitário de componentes React + Tailwind no formato shadcn — heros, dialogs, sidebars, text-animation, templates, temas) no Urban Grid, que NÃO usa shadcn. Use quando o usuário citar 21st.dev / 21st / Magic MCP, ou pedir um componente "pronto" de catálogo (hero, dialog, sidebar, seção de destaque) — mesmo sem citar o nome do site.
---

# 21st.dev no Urban Grid

Catálogo comunitário de componentes React + Tailwind, publicado como registry no
formato shadcn. **Antes de qualquer passo, leia**
`.claude/skills/frontend-design/componentes-externos.md` e o `SKILL.md` de
`frontend-design`. Esta skill cobre só o que é específico do 21st.dev.

## O descompasso principal

Os componentes assumem a pilha shadcn/ui: `cn()` de `@/lib/utils`, `class-variance-authority`,
primitivos Radix (o `shadcn-button`, por exemplo, lista `@radix-ui/react-slot` e
`class-variance-authority`) e tokens como `bg-primary text-primary-foreground`,
`bg-muted`, `border-input`. **O Urban Grid não tem nada disso** (sem `components.json`,
sem `utils.ts`, sem Radix/cva). Então trate o 21st.dev como **referência de estrutura
e de design**, reescrita com o vocabulário do projeto — não instale a pilha shadcn
por causa de um componente.

Tradução dos tokens mais comuns (confira em `lib/estilos.ts`):

| shadcn | Urban Grid |
| --- | --- |
| `bg-muted` | `bg-slate-100 dark:bg-slate-800` |
| `text-muted-foreground` | `text-slate-500 dark:text-slate-400` |
| `border-border` / `border-input` | `border-slate-200 dark:border-slate-800` (ou `campoInput`) |
| `bg-card` | `bg-white dark:bg-slate-900` (ou `cartao`) |
| `bg-primary text-primary-foreground` | `botaoPrimario` |
| `cn(...)` / `cva(...)` | template string ou constante em `lib/estilos.ts` |
| Dialog/Popover/Accordion do Radix | `<details>`, `<dialog>` ou o hook `useFecharAoInteragirFora`, como já é feito no projeto |

## Como ler um componente

- Página em markdown, sem navegador:
  `https://21st.dev/@<autor>/components/<slug>.md`. Traz metadados, autor, **licença**,
  dependências e o comando de instalação — **não traz o código** (conferido no
  `shadcn-button` de `@jayur830`).
- Por categoria: `https://21st.dev/community/components/s/<tag>.md` (tags como `hero`,
  `ai-chat`, `pricing-section`, `sidebar`, `dialog`, `text-animation`).
- Visão geral para agentes: `https://21st.dev/llms.txt`.

## Como obter o código

A instalação é `npx shadcn@latest add "https://21st.dev/r/<autor>/<slug>?api_key=$API_KEY_21ST"`
e **exige API key** (conta gratuita tem limite diário de instalações). Neste projeto,
não rode isso: sem `components.json`, é o caminho que traz a pilha shadcn junto.

- **Caminho padrão**: peça ao usuário para colar o código da aba *Code* do componente
  (ou usar *Copy prompt*), e adapte.
- **Caminho opcional, decisão do usuário**: MCP do 21st
  (`npx @21st-dev/cli@latest init --client claude`, com `--write` para gravar a
  configuração; a chave sai em `https://21st.dev/mcp`). Ferramentas: `search` e
  `search_logo` (grátis), `get_component` (pago), `get_inspiration`, `generate`
  (pago no plano gratuito). Envolve conta, chave e custo: **não configure por conta
  própria** — ofereça e espere o pedido.

## Licença

Cada componente declara a sua (o `shadcn-button` acima mostra `License: mit`). O site
diz que os autores mantêm a autoria e que o código passa a ser seu ao entrar no
repositório, mas não declara licença única para o catálogo. Regra: **sem licença
explícita na página do componente, use só como referência e reescreva**. Com licença,
cabeçalho no arquivo: `// Adaptado de 21st.dev (<URL>), por <autor>, licença <X>.`

## Conteúdo

O catálogo é voltado a marketing de SaaS (hero, pricing, testimonials, logos de
clientes). Num app cívico, isso raramente cabe: `pricing` e `testimonials` não têm
função aqui. Use heros, dialogs, sidebars e text-animation, sempre com conteúdo do
domínio (reclamação urbana real, não lorem ipsum), e respeite a seção 4 de
`componentes-externos.md` (onde esse tipo de efeito não entra).
