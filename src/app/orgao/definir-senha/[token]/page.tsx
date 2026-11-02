import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PaginaAuth } from "@/components/ui/pagina-auth";
import { BotaoAcao, FormularioAcao } from "@/components/ui/formulario-acao";
import { prisma } from "@/lib/prisma";
import { botaoPrimario, botaoSecundario } from "@/lib/estilos";

import { reenviarConviteExpirado } from "./actions";
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
  const contaPendente = !!usuario && usuario.papel === "ORGAO" && !usuario.senhaHash;
  const valido = !!registro && registro.expires > new Date() && contaPendente;

  // Convite vencido de uma conta que ainda não definiu a senha: quem tem o link em mãos pede
  // outro aqui mesmo, sem depender de achar um administrador.
  if (!valido && registro && contaPendente) {
    return (
      <PaginaAuth titulo={t("linkExpiradoTitulo")} descricao={t("linkExpiradoDesc")}>
        <FormularioAcao action={reenviarConviteExpirado.bind(null, token)} className="flex flex-col gap-3">
          <BotaoAcao className={`${botaoPrimario} w-full py-3`}>{t("enviarNovoLink")}</BotaoAcao>
        </FormularioAcao>
        <Link href="/login" className={`${botaoSecundario} w-full py-3`}>
          {t("irParaLogin")}
        </Link>
      </PaginaAuth>
    );
  }

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
