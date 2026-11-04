// Quanto tempo uma reclamação publicada pode ficar sem nenhuma resposta oficial antes de passar a
// pesar contra os órgãos que a atendem. É um prazo único para a plataforma (não por categoria):
// o objetivo é que o silêncio apareça, não arbitrar o que é urgente. Quem responde, mesmo que só
// para dar um prazo, tira a reclamação desta conta.
//
// Usado pelo resumo semanal do órgão ("já passaram de 15 dias") e pelo índice de reputação.
export const PRAZO_SEM_RESPOSTA_DIAS = 15;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

// Publicada nesta data ou antes = já está além do prazo.
export function limiteDoPrazoSemResposta(agora: Date): Date {
  return new Date(agora.getTime() - PRAZO_SEM_RESPOSTA_DIAS * MS_POR_DIA);
}
