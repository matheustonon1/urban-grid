import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PaginaAuth } from "@/components/ui/pagina-auth";
import { prisma } from "@/lib/prisma";
import { emailDoTokenRedefinicao } from "@/lib/email";
import { botaoPrimario } from "@/lib/estilos";

import { FormularioRedefinirSenha } from "./formulario";

export default async function RedefinirSenhaPage({
  params,
}: PageProps<"/redefinir-senha/[token]">) {
  const t = await getTranslations("RedefinirSenha");
  const { token } = await params;

  const registro = await prisma.verificationToken.findUnique({ where: { token } });
  const email = registro ? emailDoTokenRedefinicao(registro.identifier) : null;
  const usuario = email ? await prisma.user.findUnique({ where: { email } }) : null;
  const valido = !!registro && registro.expires > new Date() && !!usuario?.senhaHash;

  if (!valido) {
    return (
      <PaginaAuth titulo={t("linkInvalidoTitulo")} descricao={t("linkInvalidoDesc")}>
        <Link href="/esqueci-senha" className={`${botaoPrimario} w-full py-3`}>
          {t("pedirNovoLink")}
        </Link>
      </PaginaAuth>
    );
  }

  return (
    <PaginaAuth
      titulo={t("criarNovaSenha")}
      descricao={t("escolhaNovaSenha", { email: usuario!.email })}
    >
      <FormularioRedefinirSenha token={token} />
    </PaginaAuth>
  );
}
