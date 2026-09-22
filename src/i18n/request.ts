import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { COOKIE_IDIOMA, IDIOMA_PADRAO, idiomaValido } from "./config";

// Sem roteamento por locale (sem segmento [locale] na URL) de propósito -
// o site inteiro continua em português por padrão pra quem não mexe em
// nada, e o idioma escolhido persiste só via cookie. Trocar de idioma
// não muda a URL, só reflete no HTML renderizado a partir da próxima
// requisição (ver componente SeletorIdioma).
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const valor = cookieStore.get(COOKIE_IDIOMA)?.value;
  const locale = idiomaValido(valor) ? valor : IDIOMA_PADRAO;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
