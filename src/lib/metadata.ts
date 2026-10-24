import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

// Título de aba traduzido, tirado de <namespace>.<chave> - o mesmo texto que
// a página usa no <h1>. Sem isto, toda aba mostrava só "Urban Grid" (ruim pra
// quem alterna entre abas e pra leitor de tela: WCAG 2.4.2, "página com
// título"). O sufixo " · Urban Grid" vem do template do layout raiz.
//
// Uso, no page.tsx:  export const generateMetadata = metadataDaPagina("Painel");
export function metadataDaPagina(namespace: string, chave = "titulo") {
  return async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations(namespace);
    return { title: t(chave) };
  };
}
