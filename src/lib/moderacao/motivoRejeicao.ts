import * as z from "zod";
import type { getTranslations } from "next-intl/server";

// Compartilhado entre a rejeição de reclamação na moderação e a rejeição
// de solicitação de acesso como órgão - mesma regra (motivo obrigatório,
// 10 a 500 caracteres) nos dois fluxos, então um schema só em vez de duas
// cópias que podiam divergir silenciosamente.
export function criarMotivoRejeicaoSchema(t: Awaited<ReturnType<typeof getTranslations>>) {
  return z.object({
    motivo: z.string().trim().min(10, { error: t("erroMotivoCurto") }).max(500),
  });
}
