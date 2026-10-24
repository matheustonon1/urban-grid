import { createTranslator } from "use-intl";

import type { Idioma } from "@/i18n/config";

import type { RotulosLayout } from "./layout";

// E-mail não tem cookie de navegação de quem vai ler (quem dispara nem
// sempre é o destinatário - moderação, resposta oficial, aprovação de
// órgão) - o idioma vem de onde foi persistido (User.idioma ou
// SolicitacaoOrgao.idioma), passado explicitamente por quem chama. Usa o
// mesmo messages/*.json do resto do site (namespace "Email"), só que via
// createTranslator (use-intl) em vez de next-intl/server, que depende de
// request scope.
export async function tradutor(locale: Idioma) {
  const mensagens = (await import(`../../../messages/${locale}.json`)).default;
  return createTranslator({ locale, messages: mensagens, namespace: "Email" });
}

export type Tradutor = Awaited<ReturnType<typeof tradutor>>;

// Textos fixos da moldura (rodapé automático, link alternativo, marca).
export function rotulosDoLayout(t: Tradutor): RotulosLayout {
  return {
    linkAlternativo: t("layout.linkAlternativo"),
    automatico: t("layout.automatico"),
    marca: t("layout.marca"),
  };
}
