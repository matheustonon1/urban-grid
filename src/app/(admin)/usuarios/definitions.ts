import * as z from "zod";
import type { getTranslations } from "next-intl/server";

// ORGAO fica de fora de propósito - aquele papel é sempre amarrado a um
// Orgao (via orgaoId) pelo fluxo de aprovação de solicitação-orgao/actions.ts,
// e trocar só o papel aqui deixaria a conta sem Orgao nenhum atrás dela.
export const PAPEIS_ATRIBUIVEIS = ["CIDADAO", "MODERADOR", "ADMIN"] as const;

export function criarAlterarPapelSchema(t: Awaited<ReturnType<typeof getTranslations>>) {
  return z.object({
    papel: z.enum(PAPEIS_ATRIBUIVEIS, { error: t("erroPapelInvalido") }),
  });
}
