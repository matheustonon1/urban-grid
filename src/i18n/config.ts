export const IDIOMAS = ["pt-BR", "en"] as const;
export type Idioma = (typeof IDIOMAS)[number];
export const IDIOMA_PADRAO: Idioma = "pt-BR";
export const COOKIE_IDIOMA = "idioma";

export function idiomaValido(valor: string | undefined): valor is Idioma {
  return !!valor && (IDIOMAS as readonly string[]).includes(valor);
}

// Campos como User.idioma/SolicitacaoOrgao.idioma são String no banco (não
// enum), então sempre voltam como string simples do Prisma - isto faz o
// narrowing pra Idioma num só lugar, com o mesmo padrão usado pro cookie.
export function idiomaOuPadrao(valor: string | null | undefined): Idioma {
  const normalizado = valor ?? undefined;
  return idiomaValido(normalizado) ? normalizado : IDIOMA_PADRAO;
}
