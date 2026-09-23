import * as z from "zod";
import type { getTranslations } from "next-intl/server";

export function criarRedefinirSenhaSchema(t: Awaited<ReturnType<typeof getTranslations>>) {
  return z
    .object({
      senha: z.string().min(8, { error: t("erroSenhaCurta") }).max(100),
      confirmarSenha: z.string().max(100),
    })
    .refine((dados) => dados.senha === dados.confirmarSenha, {
      error: t("erroSenhasDiferentes"),
      path: ["confirmarSenha"],
    });
}

export type RedefinirSenhaFormState =
  | {
      erros?: { senha?: string[]; confirmarSenha?: string[] };
      mensagem?: string;
    }
  | undefined;
