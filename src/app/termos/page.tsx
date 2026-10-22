import { getTranslations } from "next-intl/server";

import { TermosConteudo } from "@/components/formulario/termos-conteudo";
import { containerPagina } from "@/lib/estilos";
import { metadataDaPagina } from "@/lib/metadata";

export const generateMetadata = metadataDaPagina("Footer", "termos");

export default async function TermosPage() {
  const t = await getTranslations("Footer");

  return (
    <main className={`${containerPagina} max-w-2xl`}>
      <h1 className="text-2xl font-bold tracking-tight text-ink">
        {t("termos")}
      </h1>

      <TermosConteudo />
    </main>
  );
}
