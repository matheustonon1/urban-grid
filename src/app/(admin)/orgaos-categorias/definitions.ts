import * as z from "zod";
import type { getTranslations } from "next-intl/server";

import type { ResultadoEnvio } from "@/lib/email";

// Resultado do "reenviar convite" que a tela mostra: o do envio em si, mais
// "indisponivel" (o responsável já definiu a senha, ou não existe mais - não há
// convite a reenviar).
export type EstadoConvite = ResultadoEnvio | { status: "indisponivel" } | undefined;

export function criarAtualizarDadosOrgaoSchema(t: Awaited<ReturnType<typeof getTranslations>>) {
  return z.object({
    nome: z.string().trim().min(2, { error: t("erroNomeOrgao") }).max(150),
    sigla: z.string().trim().max(20).optional().or(z.literal("")),
    email: z.email({ error: t("erroEmailInvalido") }).trim().max(254).optional().or(z.literal("")),
  });
}
