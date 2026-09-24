import * as z from "zod";
import type { getTranslations } from "next-intl/server";

export function criarNovaReclamacaoSchema(t: Awaited<ReturnType<typeof getTranslations>>) {
  return z.object({
    titulo: z.string().trim().min(10, { error: t("erroTituloCurto") }).max(180),
    descricao: z
      .string()
      .trim()
      .min(30, { error: t("erroDescricaoCurta") })
      .max(3000, { error: t("erroDescricaoLonga") }),
    categoriaId: z.string().min(1, { error: t("erroCategoria") }).max(50),
    cidadeId: z.string().min(1, { error: t("erroCidade") }).max(50),
    endereco: z.string().trim().min(5, { error: t("erroEndereco") }).max(255),
    bairro: z.string().trim().min(1, { error: t("erroBairro") }).max(120),
    referencia: z.string().trim().max(255).optional().or(z.literal("")),
    cep: z.string().trim().regex(/^\d{5}-?\d{3}$/, { error: t("erroCep") }),
    declaracaoVeracidade: z.literal("on", { error: t("erroDeclaracao") }),
  });
}

export type NovaReclamacaoFormState =
  | {
      erros?: {
        titulo?: string[];
        descricao?: string[];
        categoriaId?: string[];
        cidadeId?: string[];
        endereco?: string[];
        bairro?: string[];
        referencia?: string[];
        cep?: string[];
        declaracaoVeracidade?: string[];
      };
      mensagem?: string;
    }
  | undefined;
