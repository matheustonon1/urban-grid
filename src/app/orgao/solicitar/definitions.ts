import * as z from "zod";

export const SolicitarOrgaoSchema = z.object({
  nomeOrgao: z.string().trim().min(2, { error: "Informe o nome do órgão." }).max(150),
  sigla: z.string().trim().max(20).optional().or(z.literal("")),
  cidadeId: z.string().trim().min(1, { error: "Selecione a cidade." }).max(50),
  nomeResponsavel: z
    .string()
    .trim()
    .min(2, { error: "Informe o nome do responsável." })
    .max(100),
  email: z.email({ error: "Informe um e-mail válido." }).trim().max(254),
  telefone: z.string().trim().max(20).optional().or(z.literal("")),
  aceitaTermos: z.literal("on", {
    error: "É preciso aceitar os Termos de Uso e a Política de Privacidade.",
  }),
});

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
