// Status que aparecem nas listagens/estatísticas públicas (home, filtro de
// reclamações). Uma reclamação continua "pública" depois de responder ou
// resolver - só RASCUNHO, EM_MODERAÇÃO, AGUARDANDO_REVISÃO e REJEITADA ficam
// de fora, por não terem passado (ou terem falhado) na moderação.
export const STATUS_PUBLICOS = [
  "PUBLICADA",
  "EM_ANDAMENTO",
  "RESOLVIDA",
  "ARQUIVADA",
] as const;
