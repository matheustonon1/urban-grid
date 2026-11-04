import * as z from "zod";
import type { getTranslations } from "next-intl/server";

import { cnpjValido } from "@/lib/orgaos/cnpj";
import { normalizarLinkOficial } from "@/lib/orgaos/linkOficial";

export function criarSolicitarOrgaoSchema(t: Awaited<ReturnType<typeof getTranslations>>) {
  return z.object({
    nomeOrgao: z.string().trim().min(2, { error: t("erroNomeOrgao") }).max(150),
    sigla: z.string().trim().max(20).optional().or(z.literal("")),
    cidadeId: z.string().trim().min(1, { error: t("erroCidade") }).max(50),
    nomeResponsavel: z.string().trim().min(2, { error: t("erroNomeResponsavel") }).max(100),
    email: z.email({ error: t("erroEmail") }).trim().max(254),
    // Quem confere o vínculo do órgão é uma pessoa (o admin), mas ela precisa de por onde
    // começar: o CNPJ (validado pelos dígitos, incluindo o alfanumérico) e o site oficial.
    cnpj: z
      .string()
      .trim()
      .max(30)
      .refine((valor) => cnpjValido(valor), { error: t("erroCnpj") }),
    linkOficial: z
      .string()
      .trim()
      .max(500)
      .refine((valor) => normalizarLinkOficial(valor) !== null, { error: t("erroLinkOficial") }),
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
        cnpj?: string[];
        linkOficial?: string[];
        telefone?: string[];
        aceitaTermos?: string[];
      };
      mensagem?: string;
      sucesso?: boolean;
    }
  | undefined;
