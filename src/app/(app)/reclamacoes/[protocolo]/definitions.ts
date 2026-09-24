import * as z from "zod";
import type { getTranslations } from "next-intl/server";

type T = Awaited<ReturnType<typeof getTranslations>>;

export function criarRespostaOficialSchema(t: T) {
  return z.object({
    texto: z.string().trim().min(10, { error: t("erroRespostaCurta") }),
    novoStatus: z
      .union([z.literal(""), z.enum(["EM_ANDAMENTO", "RESOLVIDA"])])
      .transform((valor) => (valor === "" ? undefined : valor)),
    prazoEstimado: z
      .union([
        z.literal(""),
        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: t("erroDataInvalida") }),
      ])
      .transform((valor) => (valor === "" ? undefined : valor)),
  });
}

export function criarAvaliacaoSchema() {
  return z.object({
    nota: z.coerce.number().int().min(1).max(5),
    resolvido: z.enum(["true", "false"]).transform((valor) => valor === "true"),
    comentario: z
      .union([z.literal(""), z.string().trim().max(1000)])
      .transform((valor) => (valor === "" ? undefined : valor)),
  });
}

export function criarDenunciaSchema(t: T) {
  return z.object({
    motivo: z.enum([
      "OFENSIVO",
      "SPAM",
      "DESINFORMACAO",
      "FORA_DE_ESCOPO",
      "DADOS_PESSOAIS",
      "DUPLICADA",
      "OUTRO",
    ]),
    descricao: z
      .union([z.literal(""), z.string().trim().max(1000)])
      .transform((valor) => (valor === "" ? undefined : valor)),
    declaracaoVeracidade: z.literal("on", { error: t("erroDeclaracaoBoaFe") }),
  });
}

export function criarRecursoSchema(t: T) {
  return z.object({
    texto: z
      .string()
      .trim()
      .min(20, { error: t("erroRecursoCurto") })
      .max(1000, { error: t("erroRecursoLongo") }),
  });
}

export function criarComentarioSchema(t: T) {
  return z.object({
    texto: z
      .string()
      .trim()
      .min(3, { error: t("erroComentarioCurto") })
      .max(1000, { error: t("erroComentarioLongo") }),
    paiId: z
      .union([z.literal(""), z.string()])
      .transform((valor) => (valor === "" ? undefined : valor)),
  });
}
