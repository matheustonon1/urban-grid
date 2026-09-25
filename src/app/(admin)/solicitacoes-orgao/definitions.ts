import * as z from "zod";
import type { getTranslations } from "next-intl/server";

export function criarRejeitarSolicitacaoSchema(t: Awaited<ReturnType<typeof getTranslations>>) {
  return z.object({
    motivo: z.string().trim().min(10, { error: t("erroMotivoCurto") }).max(500),
  });
}
