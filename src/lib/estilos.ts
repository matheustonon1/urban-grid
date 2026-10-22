// Classes compartilhadas. Todas usam os tokens semânticos de globals.css
// (bg-surface, text-ink, border-line, bg-brand...), que já trocam no escuro:
// nada de `dark:` repetido aqui. Se nenhuma serve, acrescente uma constante
// NESTE arquivo em vez de improvisar classes soltas na tela.
//
// Raio por papel, não um valor único: botão e campo `rounded-md`, cartão
// `rounded-lg`, "ficha" de destaque da home `rounded-xl`, etiqueta de estado
// `rounded-[5px]`. Superfície plana com fio de 1px; sombra só no que flutua
// (menu, diálogo) e na ficha da home.

const foco =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

const botaoBase = `inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition-colors active:translate-y-px ${foco} disabled:pointer-events-none disabled:opacity-50`;

export const botaoPrimario = `${botaoBase} bg-brand text-on-brand hover:bg-brand-strong`;

export const botaoSecundario = `${botaoBase} border border-line-strong bg-surface text-ink hover:border-ink-faint hover:bg-sunken`;

// Ação destrutiva/negativa (rejeitar, banir, desativar): contorno vermelho, sem
// preenchimento - pesa menos que o primário, mas não se confunde com um
// secundário neutro.
export const botaoPerigo = `${botaoBase} border border-danger-ink/40 bg-surface text-danger-ink hover:bg-danger-soft focus-visible:outline-danger-ink`;

export const campoInput =
  "rounded-md border border-line-strong bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:opacity-60";

// Campo com erro de validação: mesmo campo, borda e foco em vermelho. É uma
// constante própria (e não campoInput + border-red) porque duas classes de
// borda no mesmo elemento brigam pela ordem do CSS gerado, não pela ordem em
// que aparecem no className.
export const campoInputInvalido =
  "rounded-md border border-danger-ink/60 bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted transition-colors focus:border-danger-ink focus:outline-none focus:ring-2 focus:ring-danger-ink/20";

// Item de lista (reclamação, órgão, notificação).
export const cartao = "rounded-lg border border-line bg-surface p-4 transition-colors";

// Seção de página (etapa de formulário, bloco de estatística): mais respiro que
// `cartao`, que serve a itens de lista.
export const cartaoSecao = "rounded-lg border border-line bg-surface p-5 sm:p-6";

export const linkSutil =
  "inline-flex items-center justify-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-ink-muted transition-colors hover:bg-sunken hover:text-ink";

// Largura das faixas de página inteira (home, rodapé, cabeçalho): alinha tudo no
// mesmo eixo de 6xl, com o respiro lateral de sempre.
export const containerSite = "mx-auto w-full max-w-6xl px-4 sm:px-8";

export const containerPagina = "mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 p-6 sm:p-8";

// Páginas com mais coisa pra mostrar (lista, painel, cidade) respiram em 3xl;
// o detalhe da reclamação, com coluna de resumo ao lado, usa 5xl.
export const containerMedio = "mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6 sm:p-8";
export const containerLargo = "mx-auto flex w-full max-w-5xl flex-1 flex-col gap-7 p-6 sm:p-8";

// Painel secundário: informação de apoio, sem fundo branco cheio, pra não
// competir com os cartões de conteúdo - nem tudo precisa parecer um objeto solto.
export const painelSuave = "rounded-lg border border-line bg-sunken/60 p-4";

// Rótulo de seção/campo pequeno: mono em caixa alta (ver @utility kicker).
export const rotuloSecao = "kicker";

// Texto escrito por terceiros que alguém precisa AVALIAR (descrição de uma
// reclamação na fila, comentário denunciado): num bloco próprio, pra se
// distinguir de rótulos e metadados da própria tela - e pra não ser lido como
// se fosse do sistema. Preserva as quebras de linha que a pessoa digitou.
export const blocoCitacao =
  "rounded-md border border-line bg-sunken/70 px-3.5 py-3 text-sm leading-relaxed whitespace-pre-line text-ink-2";
