import * as z from "zod";
import type { getTranslations } from "next-intl/server";

import { validarCpf } from "@/lib/cpf";

// Schema como fábrica (não um objeto pronto no topo do módulo) porque as
// mensagens de erro do Zod precisam do dicionário do idioma ativo no
// momento da requisição - getTranslations() só existe dentro de uma
// server action, não no escopo do módulo.
export function criarCadastroSchema(t: Awaited<ReturnType<typeof getTranslations>>) {
  return z
    .object({
      nome: z.string().trim().min(2, { error: t("erroNome") }).max(100),
      email: z.email({ error: t("erroEmail") }).trim().max(254),
      cpf: z.string().trim().refine(validarCpf, { error: t("erroCpf") }),
      senha: z.string().min(8, { error: t("erroSenhaCurta") }).max(100),
      confirmarSenha: z.string().max(100),
      aceitaTermos: z.literal("on", { error: t("erroTermos") }),
    })
    .refine((dados) => dados.senha === dados.confirmarSenha, {
      error: t("erroSenhasDiferentes"),
      path: ["confirmarSenha"],
    });
}

export type CadastroFormState =
  | {
      erros?: {
        nome?: string[];
        email?: string[];
        cpf?: string[];
        senha?: string[];
        confirmarSenha?: string[];
        aceitaTermos?: string[];
      };
      mensagem?: string;
    }
  | undefined;
