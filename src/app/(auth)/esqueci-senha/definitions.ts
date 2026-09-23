import * as z from "zod";
import type { getTranslations } from "next-intl/server";

export function criarEsqueciSenhaSchema(t: Awaited<ReturnType<typeof getTranslations>>) {
  return z.object({
    email: z.email({ error: t("erroEmail") }).trim().max(254),
  });
}

export type EsqueciSenhaFormState =
  | {
      erros?: { email?: string[] };
      mensagem?: string;
    }
  | undefined;
