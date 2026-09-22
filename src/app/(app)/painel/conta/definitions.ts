import * as z from "zod";

// Só telefone é editável aqui - nome não é um campo que o usuário deve
// poder ficar trocando livremente (é usado como identificação pública
// em comentários e, no caso de conta de órgão, remonta à pessoa
// responsável cadastrada na solicitação de acesso).
export const PerfilSchema = z.object({
  telefone: z.string().trim().max(20).optional().or(z.literal("")),
});

export type PerfilFormState =
  | {
      erros?: { telefone?: string[] };
      mensagem?: string;
    }
  | undefined;

export const TrocaEmailSchema = z.object({
  novoEmail: z.email({ error: "Informe um e-mail válido." }).trim().max(254),
  senhaAtual: z.string().min(1, { error: "Informe sua senha atual." }).max(100),
});

export type TrocaEmailFormState =
  | {
      erros?: { novoEmail?: string[]; senhaAtual?: string[] };
      mensagem?: string;
    }
  | undefined;

export const SenhaSchema = z
  .object({
    senhaAtual: z.string().min(1, { error: "Informe sua senha atual." }).max(100),
    novaSenha: z
      .string()
      .min(8, { error: "A nova senha deve ter ao menos 8 caracteres." })
      .max(100),
    confirmarNovaSenha: z.string().max(100),
  })
  .refine((dados) => dados.novaSenha === dados.confirmarNovaSenha, {
    error: "As senhas não conferem.",
    path: ["confirmarNovaSenha"],
  });

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

export const ExclusaoSchema = z.object({
  senhaAtual: z.string().min(1, { error: "Informe sua senha atual." }).max(100),
});

export type ExclusaoFormState =
  | {
      erros?: { senhaAtual?: string[] };
      mensagem?: string;
    }
  | undefined;

export const ConfirmarTotpSchema = z.object({
  codigo: z
    .string()
    .trim()
    .regex(/^\d{6}$/, { error: "Informe os 6 dígitos do código." }),
});

export type ConfirmarTotpFormState =
  | {
      erros?: { codigo?: string[] };
      mensagem?: string;
      codigosBackup?: string[];
    }
  | undefined;

export const DesativarTotpSchema = z.object({
  senhaAtual: z.string().min(1, { error: "Informe sua senha atual." }).max(100),
});

export type DesativarTotpFormState =
  | {
      erros?: { senhaAtual?: string[] };
      mensagem?: string;
    }
  | undefined;
