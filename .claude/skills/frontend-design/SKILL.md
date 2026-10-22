---
name: frontend-design
description: Diretrizes de design visual do Urban Grid (Next.js + Tailwind v4) para toda tela, componente ou revisão de front-end deste repositório — a identidade "sinalização urbana + planta" (papel azul-acinzentado, tinta, azul de placa, amarelo de obra, Archivo + Plex), os tokens semânticos que já trocam no escuro, os componentes base e os tiques de "site feito por IA" a evitar. Use sempre que for criar uma página ou componente, redesenhar algo, revisar visualmente uma tela antes de dar por pronta, ou quando o usuário pedir "melhorar o design", "deixar mais bonito/profissional" ou "não parecer feito por IA" — mesmo sem citar "design" ou "front-end".
---

# Design do Urban Grid

A identidade é **"sinalização urbana + planta"**: o site parece uma planta técnica
de cidade com a placa de obra no lugar certo — séria, legível, pública. Foi
redesenhada por inteiro em 2026-10 (antes era azul Tailwind + terracota + cinza
frio); estenda esta base com a mesma intenção, não a substitua por hábito.

## A base (estes arquivos são a fonte da verdade — confira antes de assumir)

- **`src/app/globals.css`** — tokens e utilitários. Tudo de cor é **token semântico**
  (CSS variável com par claro/escuro, ligado ao Tailwind por `@theme inline`):

  | Token | Uso |
  |---|---|
  | `paper` / `surface` / `sunken` | fundo da página / cartão, campo / painel rebaixado, trilho, chip |
  | `line` / `line-strong` | fio de 1px (divisor, borda) / borda de campo e botão secundário |
  | `ink` / `ink-2` / `ink-muted` / `ink-faint` | texto principal / corpo / secundário (≥ 4,5:1) / só decoração |
  | `brand`, `brand-strong`, `brand-soft`, `brand-ink`, `on-brand` | **única cor interativa** (azul de placa): botão, link, foco, aba ativa |
  | `signal`, `signal-soft`, `signal-ink`, `on-signal` | amarelo de obra: acento **raro** (marca-texto, "ao vivo", contador, faixa) |
  | `ok-*`, `warn-*`, `danger-*`, `progress-*` (`-soft` e `-ink`) | estados (sucesso, atenção, erro, em andamento) |
  | `danger` / `on-danger` | botão destrutivo sólido (excluir conta) |
  | `night` / `chalk` | faixas escuras que **não** trocam no `.dark` (painel de entrada, chamada da home) |

  Como o token troca sozinho com a classe `.dark` no `<html>` (alternada por
  `components/layout/theme-toggle.tsx`), **não escreva `dark:`** por cima: `text-ink`,
  não `text-slate-900 dark:text-slate-100`. Cor nova = token novo em `globals.css`,
  com valor claro **e** escuro. (As escalas `slate-*`/`blue-*` do Tailwind foram
  redefinidas para a paleta do projeto, só para código legado não destoar.)
- **Utilitários de identidade** (`@utility`): `kicker` (rótulo mono em caixa alta —
  protocolo, índice, legenda), `marca-texto` (grifo amarelo atrás de uma palavra do
  título), `faixa-obra` (listras amarelo/tinta, fina e rara), `bg-planta` /
  `bg-planta-clara` (quadrícula de quarteirões que some em degradê), `scrollbar-none`.
- **Tipografia** (`src/app/layout.tsx`): **Archivo** nos títulos (`--font-display`,
  grotesca de placa, 700–800, `tracking-tight`), **IBM Plex Sans** no corpo,
  **IBM Plex Mono** em protocolo e números (`font-mono tabular-nums`). Nada de
  Inter/Geist por padrão.
- **`src/lib/estilos.ts`** — `botaoPrimario`, `botaoSecundario`, `botaoPerigo`,
  `campoInput`/`campoInputInvalido`, `cartao`, `cartaoSecao`, `linkSutil`, `painelSuave`,
  `blocoCitacao`, `rotuloSecao` e os contêineres (`containerSite` 6xl, `containerLargo`
  5xl, `containerMedio` 3xl, `containerPagina` 2xl). Se nenhuma serve, vira constante
  **ali**, não classe improvisada na tela.
- **Componentes** (`src/components/`, por papel):
  - `ui/` — `Marca`, `CabecalhoPagina`, `EstadoVazio`, `Aviso` (erro anuncia com
    `role="alert"`), `Etiqueta` (base de `StatusBadge`/`DecisaoBadge`/`Selo`),
    `PainelNumeros`, `Esqueleto*`, `Paginacao`, `Revelar`, `AvatarIniciais`,
    `PaginaAuth` (moldura de login/cadastro/redefinição: painel escuro + formulário)
  - `layout/` — cabeçalho fixo, rodapé, menus, sino, tema, idioma, abas do admin
  - `formulario/` — `Campo` (rótulo + dica/erro, `aria-describedby`), `cidade-combobox`,
    termos
  - `reclamacao/` e `moderacao/` — cartão de reclamação, badges, pontuações da IA…

Se o pedido for mudar fonte, paleta, tokens ou esses componentes base, confirme
que é isso mesmo: foram decisões deliberadas, não lacunas.

Vai trazer um componente de catálogo externo (React Bits, 21st.dev, Uiverse…)? Leia
antes `componentes-externos.md`, nesta pasta.

## Como a identidade se expressa

- **Plana, com fio.** Cartão = fundo `surface` + borda `line`. **Sombra só em quem
  flutua** (menu, popover, diálogo) e na "ficha" da home. Hover de cartão clicável:
  borda escurece (`hover:border-ink-faint`) e o título vira `brand` — nada de
  levantar e projetar sombra em tudo.
- **Raio por papel**: botão/campo `rounded-md`; cartão `rounded-lg`; etiqueta de estado
  `rounded-[5px]` com quadradinho de cor (como placa); ficha de destaque `rounded-xl`;
  `rounded-full` só em avatar de pessoa, ponto e barra de progresso.
- **Hierarquia editorial.** Título de página 3xl–4xl `font-extrabold`; seção `h2`
  3xl; rótulo = `kicker`. Números grandes em mono (`font-mono tabular-nums`).
  Alinhamento **à esquerda** por padrão; centralizar é exceção (estado vazio, erro).
- **Régua e índice.** Passo a passo = sequência numerada (`01`–`04`) sobre uma linha;
  bloco de destaque = `border-t-2 border-ink`; seção de página inteira alterna
  `paper` e `surface` com fio entre elas.
- **Conteúdo real é o ornamento.** A home abre com a reclamação mais recente de verdade
  numa "ficha" (protocolo, mapinha de quarteirões em SVG, etapas, confirmações) em
  vez de ilustração genérica.
- **Amarelo é tempero.** `signal` aparece em: grifo de uma palavra no título, ponto
  "ao vivo", contador de pendências, barra da aba ativa, faixa de obra, botão sobre
  fundo `night`. Nunca como cor de botão em fundo claro nem de texto corrido.
- **Movimento discreto:** `animate-fade-in` / `Revelar` (uma vez, ao entrar na tela),
  transição de cor. Respeite `prefers-reduced-motion` (`motion-reduce:`). Sem fundo
  "respirando" ou grade deslizando.

## Tiques de "design genérico de IA" — evite sem que o usuário peça

- Gradiente roxo→azul ou qualquer "hero de SaaS"; **bege cremoso + serifa + terracota**
  (o tique de 2025–26 de "site editorial feito por IA" — foi descartado de propósito).
- Cartão com risca de cor na lateral só pra decorar.
- O mesmo `rounded-lg` + sombra em **tudo**.
- Emoji como marcador de seção ou item.
- Tudo centralizado (hero, cartões, botões).
- Ícone do lucide colado em todo título/label sem função (ícone vale quando carrega
  significado: estado, ação, tipo de conteúdo).
- Selo "✨ novo" / pílula de aviso acima do título.
- Texto de preenchimento (`Lorem ipsum`, "Título aqui") — aqui é sempre reclamação
  urbana de verdade: buraco na rua, poste apagado, lixo acumulado.
- Hero com altura de tela inteira quando o conteúdo cabe em menos.
- Cinza puro misturado à paleta; cor hex solta; `dark:` por cima de um token.

## Fundamentos

- Espaçamento por `gap` de flex/grid, não margem avulsa em cada filho.
- **Nem tudo é cartão**: borda/fundo dizem "objeto separado" — gaste com intenção.
  Listas de itens relacionados são **linhas com divisória** (`divide-y divide-line`),
  não uma pilha de cartões.
- **Formulário**: sempre rótulo visível (`Campo`), nunca só placeholder; erro por
  campo com ícone + texto (`MensagemErro`), `aria-invalid` + `aria-describedby`
  (`descritoPor`), `campoInputInvalido`; erro geral em `Aviso tom="erro"`.
- **Paridade claro/escuro** vem dos tokens — confira os dois mesmo assim (contraste,
  sobreposição de texto sobre imagem, faixas `night`/`chalk`).
- **Responsividade real**: teste a 375px; o cabeçalho foi apertado de propósito
  (`gap-2`, ícones `p-1.5`) para caber logo + busca + entrar + idioma + tema. O
  E2E `responsividade.spec.ts` falha com 1px de rolagem horizontal.
- **Acessibilidade** é parte do design: skill `acessibilidade`. Texto de interface:
  skill `ux-writing`.

## Checklist antes de dar uma tela por pronta

1. Usei tokens e `lib/estilos.ts` (nada de `dark:`, hex ou `slate-*` novos)?
2. Claro **e** escuro conferidos nas imagens, não só "compila"?
3. 375px sem rolagem horizontal (script de `verificacao-visual`)?
4. Reli a lista de tiques — algum apareceu sem decisão consciente?
5. O conteúdo exibido é real/plausível do domínio?
6. Estados vazio, erro e carregando existem e combinam com o resto?
7. Cor nova? Tem token com par claro/escuro e justificativa (por que não `brand`/`signal`)?

Este filtro vem **antes** de `tsc`/`eslint`/testes e da verificação visual
(skill `verificacao-visual`), não no lugar delas.
