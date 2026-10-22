import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PaginaAuth } from "@/components/ui/pagina-auth";
import { linkSutil } from "@/lib/estilos";
import { metadataDaPagina } from "@/lib/metadata";

import { FormularioEsqueciSenha } from "./formulario";

export const generateMetadata = metadataDaPagina("EsqueciSenha");

export default async function EsqueciSenhaPage() {
  const t = await getTranslations("EsqueciSenha");

  return (
    <PaginaAuth titulo={t("titulo")} descricao={t("subtitulo")}>
      <FormularioEsqueciSenha />

      <div className="flex justify-center border-t border-line pt-5">
        <Link href="/login" className={linkSutil}>
          {t("voltarLogin")}
        </Link>
      </div>
    </PaginaAuth>
  );
}
