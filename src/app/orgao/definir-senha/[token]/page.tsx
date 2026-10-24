import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PaginaAuth } from "@/components/ui/pagina-auth";
import { prisma } from "@/lib/prisma";
import { botaoPrimario } from "@/lib/estilos";

import { FormularioDefinirSenha } from "./formulario";

export default async function DefinirSenhaOrgaoPage({
  params,
}: PageProps<"/orgao/definir-senha/[token]">) {
  const t = await getTranslations("DefinirSenhaOrgao");
  const { token } = await params;

  const registro = await prisma.verificationToken.findUnique({ where: { token } });
  const usuario = registro
    ? await prisma.user.findUnique({ where: { email: registro.identifier } })
    : null;
  const valido =
    !!registro && registro.expires > new Date() && !!usuario && !usuario.senhaHash;

  if (!valido) {
    return (
      <PaginaAuth titulo={t("linkInvalidoTitulo")} descricao={t("linkInvalidoDesc")}>
        <Link href="/login" className={`${botaoPrimario} w-full py-3`}>
          {t("irParaLogin")}
        </Link>
      </PaginaAuth>
    );
  }

  return (
    <PaginaAuth titulo={t("boasVindas", { nome: usuario!.name ?? "" })} descricao={t("defineSenha")}>
      <FormularioDefinirSenha token={token} />
    </PaginaAuth>
  );
}
