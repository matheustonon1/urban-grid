import { getLocale } from "next-intl/server";

import { IDIOMA_PADRAO, idiomaValido, type Idioma } from "./config";

// getLocale() já resolve pro IDIOMA_PADRAO quando o cookie está ausente/
// inválido (ver request.ts), então o fallback aqui é só type narrowing -
// nunca deveria disparar de verdade.
export async function obterIdiomaAtual(): Promise<Idioma> {
  const locale = await getLocale();
  return idiomaValido(locale) ? locale : IDIOMA_PADRAO;
}
