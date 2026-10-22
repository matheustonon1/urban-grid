import * as z from "zod";
import type { getTranslations } from "next-intl/server";

import type { TomRetorno } from "@/lib/acoes/resultado";

type T = Awaited<ReturnType<typeof getTranslations>>;

// Telefone e cidade padrão são editáveis aqui - nome não é um campo que o
// usuário deve poder ficar trocando livremente (é usado como
// identificação pública em comentários e, no caso de conta de órgão,
// remonta à pessoa responsável cadastrada na solicitação de acesso).
// cidadeId vazio = sem cidade padrão; a existência da cidade é checada na
// action (aqui só o formato).
export function criarPerfilSchema() {
  return z.object({
    telefone: z.string().trim().max(20).optional().or(z.literal("")),
    cidadeId: z.string().trim().max(50).optional().or(z.literal("")),
  });
}

export type PerfilFormState =
  | {
      erros?: { telefone?: string[]; cidadeId?: string[] };
      mensagem?: string;
      // Sem `tipo`, a mensagem é um erro (o caso comum); sucesso e info são marcados.
      tipo?: TomRetorno;
    }
  | undefined;

// Ações que só devolvem uma frase (preferências, reenviar verificação).
export type MensagemFormState = { mensagem?: string; tipo?: TomRetorno } | undefined;

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
      // Sem `tipo`, a mensagem é um erro (o caso comum); sucesso e info são marcados.
      tipo?: TomRetorno;
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
      // Sem `tipo`, a mensagem é um erro (o caso comum); sucesso e info são marcados.
      tipo?: TomRetorno;
    }
  | undefined;

// Ações que só pedem a senha atual como confirmação (excluir conta,
// desativar 2FA, gerar códigos de backup). `t` precisa ser o tradutor de
// "Conta", que é onde mora erroSenhaAtual.
export function criarSenhaAtualSchema(t: T) {
  return z.object({
    senhaAtual: z.string().min(1, { error: t("erroSenhaAtual") }).max(100),
  });
}

export type SenhaAtualFormState =
  | {
      erros?: { senhaAtual?: string[] };
      mensagem?: string;
      // Sem `tipo`, a mensagem é um erro (o caso comum); sucesso e info são marcados.
      tipo?: TomRetorno;
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
      // Sem `tipo`, a mensagem é um erro (o caso comum); sucesso e info são marcados.
      tipo?: TomRetorno;
      codigosBackup?: string[];
    }
  | undefined;

export type RegenerarCodigosFormState =
  | (NonNullable<SenhaAtualFormState> & { codigosBackup?: string[] })
  | undefined;
