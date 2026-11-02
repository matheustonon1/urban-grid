import type { StatusReclamacao } from "@prisma/client";

// Quando o autor pode avaliar uma reclamação resolvida.
//
// "Resolvida" é o órgão que diz; a avaliação é o autor confirmando ou contestando. Uma
// contestação ("não foi resolvido") REABRE a reclamação (ver avaliarReclamacao) - senão
// ela ficaria resolvida para sempre, com o autor discordando e o órgão sem aviso nem como
// responder. Quando o órgão a resolve de novo, o autor volta a poder avaliar e a nova
// avaliação SUBSTITUI a contestada. Uma confirmação ("foi resolvido") é definitiva.
//
// `createdAt` da avaliação é a data da avaliação vigente (a substituição a atualiza):
// "resolvida depois da última avaliação" é o que libera avaliar de novo.
export function podeAvaliar(
  reclamacao: { status: StatusReclamacao; resolvidaEm: Date | null },
  avaliacao: { resolvido: boolean; createdAt: Date } | null
): boolean {
  if (reclamacao.status !== "RESOLVIDA") return false;
  if (!avaliacao) return true;
  if (avaliacao.resolvido) return false;
  return reclamacao.resolvidaEm !== null && reclamacao.resolvidaEm > avaliacao.createdAt;
}
