import { getTranslations } from "next-intl/server";

import { TermosConteudo } from "@/components/formulario/termos-conteudo";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { pagina } from "@/lib/estilos";
import { metadataDaPagina } from "@/lib/metadata";

export const generateMetadata = metadataDaPagina("Footer", "termos");

export default async function TermosPage() {
  const t = await getTranslations("Footer");

  return (
    <main className={pagina}>
      <CabecalhoPagina titulo={t("termos")} />

      <div className="max-w-3xl">
        <TermosConteudo />
      </div>
    </main>
  );
}
