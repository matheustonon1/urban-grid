import * as z from "zod";
import type { getTranslations } from "next-intl/server";

type T = Awaited<ReturnType<typeof getTranslations>>;

// Só telefone é editável aqui - nome não é um campo que o usuário deve
// poder ficar trocando livremente (é usado como identificação pública
// em comentários e, no caso de conta de órgão, remonta à pessoa
// responsável cadastrada na solicitação de acesso).
export function criarPerfilSchema() {
  return z.object({
    telefone: z.string().trim().max(20).optional().or(z.literal("")),
  });
}

export type PerfilFormState =
  | {
      erros?: { telefone?: string[] };
      mensagem?: string;
    }
  | undefined;

export function criarTrocaEmailSchema(t: T) {
  return z.object({
    novoEmail: z.email({ error: t("erroEmailInvalido") }).trim().max(254),
    senhaAtual: z.string().min(1, { error: t("erroSenhaAtual") }).max(100),
  });
}

export type TrocaEmailFormState =
  | {
      erros?: { novoEmail?: string[]; senhaAtual?: string[] };
      mensagem?: string;
    }
  | undefined;

export function criarSenhaSchema(t: T) {
  return z
    .object({
      senhaAtual: z.string().min(1, { error: t("erroSenhaAtual") }).max(100),
      novaSenha: z.string().min(8, { error: t("erroNovaSenhaCurta") }).max(100),
      confirmarNovaSenha: z.string().max(100),
    })
    .refine((dados) => dados.novaSenha === dados.confirmarNovaSenha, {
      error: t("erroSenhasDiferentes"),
      path: ["confirmarNovaSenha"],
    });
}

export type SenhaFormState =
  | {
      erros?: {
        senhaAtual?: string[];
        novaSenha?: string[];
        confirmarNovaSenha?: string[];
      };
      mensagem?: string;
    }
  | undefined;

export function criarExclusaoSchema(t: T) {
  return z.object({
    senhaAtual: z.string().min(1, { error: t("erroSenhaAtual") }).max(100),
  });
}

export type ExclusaoFormState =
  | {
      erros?: { senhaAtual?: string[] };
      mensagem?: string;
    }
  | undefined;

export function criarConfirmarTotpSchema(t: T) {
  return z.object({
    codigo: z.string().trim().regex(/^\d{6}$/, { error: t("erroCodigo6Digitos") }),
  });
}

export type ConfirmarTotpFormState =
  | {
      erros?: { codigo?: string[] };
      mensagem?: string;
      codigosBackup?: string[];
    }
  | undefined;

export function criarDesativarTotpSchema(t: T) {
  return z.object({
    senhaAtual: z.string().min(1, { error: t("erroSenhaAtual") }).max(100),
  });
}

export type DesativarTotpFormState =
  | {
      erros?: { senhaAtual?: string[] };
      mensagem?: string;
    }
  | undefined;
