export const botaoPrimario =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-blue-800 hover:shadow-md active:translate-y-0 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400";

export const botaoSecundario =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-sm active:translate-y-0 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-400/60";

export const campoInput =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500";

export const cartao =
  "rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900";

export const cartaoDestaque =
  "w-full rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-900/5 backdrop-blur-sm transition-colors dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-black/20";

export const linkSutil =
  "inline-flex items-center justify-center gap-1 rounded-full px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-primary dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-blue-400";

export const containerPagina = "mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-6 sm:p-8";

// Páginas com mais coisa pra mostrar (lista, painel, cidade) respiram em
// 3xl; o detalhe da reclamação, com coluna de resumo ao lado, usa 5xl.
export const containerMedio = "mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 p-6 sm:p-8";
export const containerLargo = "mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6 sm:p-8";

// Painel secundário: informação de apoio, sem sombra nem fundo branco cheio,
// pra não competir com os cartões de conteúdo (cartao) - nem tudo precisa
// parecer um objeto solto na página.
export const painelSuave =
  "rounded-lg border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/50";

// Rótulo de seção/campo pequeno, em caixa alta (mesmo tratamento do formulário
// de nova reclamação).
export const rotuloSecao =
  "text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400";

// Ação destrutiva/negativa (rejeitar, banir, desativar): contorno vermelho,
// sem preenchimento - pesa menos que o botão primário, mas não se confunde
// com um botão secundário neutro. Existia colado à mão em mais de uma tela.
export const botaoPerigo =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-all hover:-translate-y-0.5 hover:bg-red-50 active:translate-y-0 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:pointer-events-none disabled:opacity-50 dark:border-red-800 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-950/40";

// Texto escrito por terceiros que alguém precisa AVALIAR (descrição de uma
// reclamação na fila, comentário denunciado): num bloco próprio, pra se
// distinguir de rótulos e metadados da própria tela - e pra não ser lido como
// se fosse do sistema. Preserva as quebras de linha que a pessoa digitou.
export const blocoCitacao =
  "rounded-lg bg-slate-50 px-3.5 py-3 text-sm leading-relaxed whitespace-pre-line text-slate-800 dark:bg-slate-900/60 dark:text-slate-200";
