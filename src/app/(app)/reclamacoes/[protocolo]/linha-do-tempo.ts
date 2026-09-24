import type { Avaliacao, Orgao, Reclamacao, RespostaOficial } from "@prisma/client";
import type { getTranslations } from "next-intl/server";

export interface EventoTimeline {
  data: Date;
  titulo: string;
  descricao?: string;
}

// Recebe as funções de tradução por parâmetro (não usa useTranslations/
// getTranslations direto aqui) porque isto não é um componente - é uma
// função pura chamada de dentro do Server Component da página.
export function construirLinhaDoTempo(
  reclamacao: Reclamacao,
  respostas: (RespostaOficial & { orgao: Orgao })[],
  avaliacao: Avaliacao | null,
  t: Awaited<ReturnType<typeof getTranslations>>,
  tStatus: Awaited<ReturnType<typeof getTranslations>>
): EventoTimeline[] {
  const eventos: EventoTimeline[] = [
    { data: reclamacao.createdAt, titulo: t("timelineRegistrada") },
  ];

  if (reclamacao.publicadaEm) {
    eventos.push({ data: reclamacao.publicadaEm, titulo: t("timelinePublicada") });
  }

  if (reclamacao.status === "REJEITADA" && reclamacao.motivoRejeicao) {
    eventos.push({
      data: reclamacao.updatedAt,
      titulo: t("timelineRejeitada"),
      descricao: reclamacao.motivoRejeicao,
    });
  }

  for (const resposta of respostas) {
    eventos.push({
      data: resposta.createdAt,
      titulo: t("timelineRespostaDe", { orgao: resposta.orgao.nome }),
      descricao:
        resposta.texto +
        (resposta.novoStatus
          ? ` (${t("timelineNovoStatus", { status: tStatus(resposta.novoStatus) })})`
          : ""),
    });
  }

  if (avaliacao) {
    eventos.push({
      data: avaliacao.createdAt,
      titulo: avaliacao.resolvido
        ? t("timelineConfirmouResolucao")
        : t("timelineContestouResolucao"),
      descricao: avaliacao.comentario ?? undefined,
    });
  }

  return eventos.sort((a, b) => a.data.getTime() - b.data.getTime());
}
