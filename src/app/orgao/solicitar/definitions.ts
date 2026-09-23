import * as z from "zod";
import type { getTranslations } from "next-intl/server";

export function criarSolicitarOrgaoSchema(t: Awaited<ReturnType<typeof getTranslations>>) {
  return z.object({
    nomeOrgao: z.string().trim().min(2, { error: t("erroNomeOrgao") }).max(150),
    sigla: z.string().trim().max(20).optional().or(z.literal("")),
    cidadeId: z.string().trim().min(1, { error: t("erroCidade") }).max(50),
    nomeResponsavel: z.string().trim().min(2, { error: t("erroNomeResponsavel") }).max(100),
    email: z.email({ error: t("erroEmail") }).trim().max(254),
    telefone: z.string().trim().max(20).optional().or(z.literal("")),
    aceitaTermos: z.literal("on", { error: t("erroTermos") }),
  });
}

export type SolicitarOrgaoFormState =
  | {
      erros?: {
        nomeOrgao?: string[];
        sigla?: string[];
        cidadeId?: string[];
        nomeResponsavel?: string[];
        email?: string[];
        telefone?: string[];
        aceitaTermos?: string[];
      };
      mensagem?: string;
      sucesso?: boolean;
    }
  | undefined;
