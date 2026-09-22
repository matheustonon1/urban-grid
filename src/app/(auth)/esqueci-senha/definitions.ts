import * as z from "zod";

export const EsqueciSenhaSchema = z.object({
  email: z.email({ error: "Informe um e-mail válido." }).trim().max(254),
});

export type EsqueciSenhaFormState =
  | {
      erros?: { email?: string[] };
      mensagem?: string;
    }
  | undefined;
