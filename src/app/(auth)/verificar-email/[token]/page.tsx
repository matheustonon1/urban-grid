import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PaginaAuth } from "@/components/ui/pagina-auth";
import { prisma } from "@/lib/prisma";
import { botaoPrimario } from "@/lib/estilos";

export default async function VerificarEmailPage({
  params,
}: PageProps<"/verificar-email/[token]">) {
  const t = await getTranslations("VerificarEmail");
  const { token } = await params;

  const registro = await prisma.verificationToken.findUnique({
    where: { token },
  });

  const valido = !!registro && registro.expires > new Date();

  // Não apaga o token depois de usar: muitos provedores de e-mail
  // pré-visitam automaticamente os links da mensagem pra escanear
  // malware (Outlook Safe Links, Gmail, proxies corporativos) antes do
  // usuário clicar de verdade. Se o token fosse de uso único, essa
  // pré-visita "gastaria" o link e o clique real do usuário cairia em
  // "expirado", mesmo com o e-mail já verificado por baixo dos panos.
  // Verificar e-mail é idempotente (diferente de reset de senha), então
  // não há risco em deixar o link válido até a expiração natural (24h).
  if (valido) {
    const usuario = await prisma.user.findUnique({
      where: { email: registro.identifier },
    });

    if (usuario && !usuario.emailVerified) {
      await prisma.user.update({
        where: { id: usuario.id },
        data: {
          emailVerified: new Date(),
          ...(usuario.nivelVerificacao === "NAO_VERIFICADO"
            ? { nivelVerificacao: "EMAIL" }
            : {}),
        },
      });
    }
  }

  return (
    <PaginaAuth
      titulo={valido ? t("verificado") : t("linkInvalido")}
      descricao={valido ? t("verificadoDesc") : t("linkInvalidoDesc")}
    >
      <Link href="/painel" className={`${botaoPrimario} w-full py-3`}>
        {t("irParaPainel")}
      </Link>
    </PaginaAuth>
  );
}
