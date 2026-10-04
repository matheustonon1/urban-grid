---
name: frontend-design
description: Diretrizes de design visual do Urban Grid (Next.js + Tailwind v4) para toda tela, componente ou revisão de front-end deste repositório — evita o visual genérico de "site feito por IA" (gradiente roxo-azul, cartão com risca lateral, tudo com o mesmo radius/sombra) e reaproveita os tokens/componentes já estabelecidos no projeto em vez de inventar novos. Use esta skill sempre que for criar uma página ou componente novo, redesenhar algo existente, revisar visualmente uma tela antes de dar por pronta, ou quando o usuário pedir pra "melhorar o design", "deixar mais bonito/profissional" ou "não parecer feito por IA" — mesmo que ele não cite "design" ou "front-end" explicitamente.
---

# Design do Urban Grid

Este projeto já tem identidade visual deliberada — fontes, paleta e componentes
foram escolhidos com justificativa, não são o default de nenhum gerador. O
trabalho aqui é **estender** essa base com a mesma intenção, não substituí-la
por hábito nem preencher qualquer lacuna com o primeiro padrão genérico que
vier à cabeça.

## A base já existente (confira antes de assumir — estes arquivos são a fonte da verdade)

- **Tipografia** (`src/app/layout.tsx`): Space Grotesk nos títulos
  (`--font-display`, geométrica/técnica, remete a planta urbana — combina com
  o nome do produto) + IBM Plex Sans no corpo (`--font-plex-sans`, legibilidade
  alta, associada a serviços públicos digitais) + IBM Plex Mono para dados/código
  (`--font-plex-mono`). Nunca Inter/Geist por padrão — já foi trocado de propósito.
- **Paleta** (`src/app/globals.css`): `--background`/`--foreground`, `--primary`
  (azul), e um `--accent` terracota deliberadamente escolhido como contraponto
  **quente** ao azul — não é mais um gradiente "SaaS" no botão principal, é um
  acento usado com moderação (o comentário no próprio CSS explica a decisão).
  Os dois têm variantes dark já calibradas.
- **Dark mode**: classe `.dark` no `<html>`, alternada por
  `src/components/theme-toggle.tsx`, persistida em `localStorage`. Isto NÃO é
  `prefers-color-scheme`/`data-theme` — é a classe `.dark` do Tailwind mesmo.
  Qualquer cor nova precisa de um par claro/escuro seguindo essa mesma convenção.
- **Componentes de estilo** (`src/lib/estilos.ts`): `botaoPrimario`,
  `botaoSecundario`, `campoInput`, `cartao`, `cartaoDestaque`, `linkSutil`,
  `containerPagina`. Reaproveite essas classes em vez de escrever um botão/card
  do zero — se nenhuma serve, é um sinal pra adicionar uma nova constante ali
  (reutilizável), não pra improvisar classes soltas só naquele componente.

Se o pedido for para mudar fonte, paleta ou esses componentes base, confirme
que é isso mesmo antes de agir — são decisões já tomadas de propósito, não
lacunas esquecidas.

## Tiques de "design genérico de IA" — evite sem que o usuário peça

Estes são os padrões que mais entregam uma tela feita às pressas por um
gerador, porque aparecem com frequência suspeita em sites gerados por IA sem
direção visual específica. Evite por padrão; só use algum deles se o usuário
pedir explicitamente:

- Gradiente roxo→azul (ou qualquer gradiente "hero" de SaaS genérico) — o
  projeto já resolveu isso com o par azul/terracota.
- Cartão com uma risca/barra de cor na lateral só pra "decorar".
- O mesmo `rounded-lg` e a mesma sombra em **tudo**, sem variar por
  importância do elemento.
- Emoji como marcador de seção ou de item de lista.
- Tudo centralizado (texto, botões, cards) só porque "parece mais limpo".
- Ícone decorativo do lucide-react colado em todo título/label sem function
  real (diferencia de um ícone que carrega significado, tipo status ou ação).
- Texto de preenchimento óbvio (`Lorem ipsum`, "Título aqui", "descrição da
  reclamação") em vez de conteúdo real do domínio — aqui é sempre reclamação
  urbana de verdade: buraco na rua, poste apagado, lixo acumulado, etc.
- Hero gigante (altura de tela inteira) quando o conteúdo real cabe em bem
  menos espaço.

## Fundamentos que valem pra qualquer tela nova ou revisão

- **Hierarquia tipográfica de verdade**: a diferença entre título e corpo não
  é só `font-size` maior — pesa peso (`font-display` já é mais pesado),
  tracking (`letter-spacing: -0.01em` já aplicado em h1-h3) e espaçamento ao
  redor. Não adicione mais um nível de hierarquia sem necessidade.
- **Espaçamento por `gap` de flex/grid**, não margin avulsa em cada filho —
  mais fácil de manter consistente e evita margin colapsando/dobrando.
- **Cinza com leve viés de matiz**, não cinza puro — o Tailwind `slate-*` já
  usado no projeto tem esse viés frio embutido; continue nessa escala em vez
  de misturar `gray-*` puro no meio.
- **Nem tudo é cartão**: borda, fundo e sombra comunicam "isto é um objeto
  separado" — gaste isso com intenção (destacar o que realmente precisa) em
  vez de embrulhar cada bloco de conteúdo em `cartao` por reflexo.
- **Paridade claro/escuro**: toda cor nova precisa funcionar nos dois temas
  antes de considerar pronto — não só "não quebrar", mas manter contraste e
  legibilidade equivalentes nos dois.
- **Responsividade real**: teste a 375px de largura, não só redimensione a
  janela do desktop. Overflow horizontal em mobile é o bug visual mais comum
  e mais fácil de não notar sem testar de verdade.
- **Conteúdo real em vez de placeholder**: ao mostrar um exemplo de tela
  (screenshot, protótipo, dado de demonstração), use um caso plausível do
  domínio (uma reclamação de buraco na rua, não "Reclamação de exemplo 1").

## Checklist antes de dar uma tela por pronta

1. Reaproveitei os componentes de `lib/estilos.ts` em vez de inventar classes
   novas onde já existe equivalente?
2. Testei em claro **e** escuro — as duas versões têm contraste e hierarquia
   equivalentes, não só "não quebrou"?
3. Testei em ~375px de largura — sem overflow horizontal, sem texto cortado?
4. Reli a lista de tiques genéricos acima — algum apareceu sem eu ter decidido
   conscientemente usá-lo?
5. O conteúdo exibido é real/plausível do domínio (reclamação urbana), não
   placeholder genérico?
6. Se adicionei uma cor nova: ela tem par claro/escuro e passa pelo mesmo
   crivo de "por que essa cor e não `--primary`/`--accent`"?

Isto não substitui ver a tela renderizada de verdade (screenshot real,
`tsc`/`eslint`/testes) — é o filtro de design a aplicar **antes** dessa
verificação técnica, não depois dela.
