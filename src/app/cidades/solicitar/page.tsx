import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PaginaAuth } from "@/components/ui/pagina-auth";
import { linkSutil } from "@/lib/estilos";
import { metadataDaPagina } from "@/lib/metadata";

import { FormularioSolicitarCidade } from "./formulario";

export const generateMetadata = metadataDaPagina("SolicitarCidade");

export default async function SolicitarCidadePage() {
  const t = await getTranslations("SolicitarCidade");

  return (
    <PaginaAuth titulo={t("titulo")} descricao={t("subtitulo")}>
      <FormularioSolicitarCidade />

      <div className="flex justify-center border-t border-line pt-5">
        <Link href="/" className={linkSutil}>
          {t("voltarInicio")}
        </Link>
      </div>
    </PaginaAuth>
  );
}
