export const IDIOMAS = ["pt-BR", "en"] as const;
export type Idioma = (typeof IDIOMAS)[number];
export const IDIOMA_PADRAO: Idioma = "pt-BR";
export const COOKIE_IDIOMA = "idioma";

export function idiomaValido(valor: string | undefined): valor is Idioma {
  return !!valor && (IDIOMAS as readonly string[]).includes(valor);
}
