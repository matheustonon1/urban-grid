import * as z from "zod";
import type { getTranslations } from "next-intl/server";

export { criarMotivoRejeicaoSchema as criarRejeitarSolicitacaoCidadeSchema } from "@/lib/motivoRejeicao";

// Código de município do IBGE: sempre 7 dígitos. Não é preenchido por quem
// solicita (ver comentário no model SolicitacaoCidade) - o admin digita na
// hora de aprovar, então valida aqui como qualquer outra entrada de
// formulário.
export function criarAprovarSolicitacaoCidadeSchema(
  t: Awaited<ReturnType<typeof getTranslations>>
) {
  return z.object({
    codigoIbge: z.string().trim().regex(/^\d{7}$/, { error: t("erroCodigoIbge") }),
  });
}
