import * as z from "zod";
import type { getTranslations } from "next-intl/server";

export function criarAtualizarDadosOrgaoSchema(t: Awaited<ReturnType<typeof getTranslations>>) {
  return z.object({
    nome: z.string().trim().min(2, { error: t("erroNomeOrgao") }).max(150),
    sigla: z.string().trim().max(20).optional().or(z.literal("")),
    email: z.email({ error: t("erroEmailInvalido") }).trim().max(254).optional().or(z.literal("")),
  });
}
