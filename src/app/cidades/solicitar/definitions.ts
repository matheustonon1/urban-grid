import * as z from "zod";
import type { getTranslations } from "next-intl/server";

type T = Awaited<ReturnType<typeof getTranslations>>;

// Mesma lista usada pra restringir a UF a um valor real antes de tentar
// achar o Estado correspondente no banco na aprovação (ver
// aprovarSolicitacaoCidade em app/(admin)/solicitacoes-cidade/actions.ts).
export const UFS_BRASIL = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
] as const;

export function criarSolicitarCidadeSchema(t: T) {
  return z.object({
    nomeCidade: z.string().trim().min(2, { error: t("erroNomeCidade") }).max(100),
    uf: z.enum(UFS_BRASIL, { error: t("erroUf") }),
    nomeSolicitante: z.string().trim().min(2, { error: t("erroNomeSolicitante") }).max(150),
    email: z.email({ error: t("erroEmailInvalido") }).trim().max(254),
  });
}

export type SolicitarCidadeFormState =
  | {
      erros?: {
        nomeCidade?: string[];
        uf?: string[];
        nomeSolicitante?: string[];
        email?: string[];
      };
      mensagem?: string;
      sucesso?: boolean;
    }
  | undefined;
