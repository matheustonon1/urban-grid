import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PaginaAuth } from "@/components/ui/pagina-auth";
import { prisma } from "@/lib/prisma";
import { dadosDoTokenTrocaEmail } from "@/lib/email";
import { botaoPrimario } from "@/lib/estilos";

export default async function ConfirmarEmailPage({
  params,
}: PageProps<"/confirmar-email/[token]">) {
  const t = await getTranslations("ConfirmarEmail");
  const { token } = await params;

  const registro = await prisma.verificationToken.findUnique({ where: { token } });
  const dados = registro ? dadosDoTokenTrocaEmail(registro.identifier) : null;
  const expirado = !registro || registro.expires <= new Date();

  let mensagem = t("linkInvalido");
  let sucesso = false;

  if (dados && !expirado) {
    const usuario = await prisma.user.findUnique({ where: { id: dados.userId } });

    // Conta excluída não troca de e-mail: sem isto, um link pedido antes da
    // exclusão (válido por 1h) gravava o e-mail novo numa conta já
    // anonimizada, deixando esse endereço "em uso" por uma conta morta.
    if (!usuario?.ativo) {
      mensagem = t("linkInvalido");
    } else if (usuario.email === dados.novoEmail) {
      // Já foi confirmado antes (ex.: provedor de e-mail pré-visitou o
      // link) - idempotente igual verificar-email, não é erro reexibir
      // sucesso num clique repetido.
      sucesso = true;
      mensagem = t("confirmado");
    } else {
      const emailEmUso = await prisma.user.findUnique({ where: { email: dados.novoEmail } });
      if (emailEmUso) {
        mensagem = t("emUso");
      } else {
        await prisma.user.update({
          where: { id: usuario.id },
          data: {
            email: dados.novoEmail,
            emailVerified: new Date(),
            // Sessão JWT guarda o e-mail de quando logou e não é
            // revalidada contra o banco por padrão (ver callback jwt em
            // auth.ts) - sem isso, uma sessão já aberta continuaria
            // mostrando o e-mail antigo até expirar sozinha. Reusa o
            // mesmo campo de invalidação do fluxo de troca de senha.
            senhaAlteradaEm: new Date(),
          },
        });
        sucesso = true;
        mensagem = t("confirmado");
      }
    }
  } else if (expirado) {
    mensagem = t("expirado");
  }

  return (
    <PaginaAuth
      titulo={sucesso ? t("atualizado") : t("linkInvalidoTitulo")}
      descricao={mensagem}
    >
      <Link href="/login" className={`${botaoPrimario} w-full py-3`}>
        {t("irParaLogin")}
      </Link>
    </PaginaAuth>
  );
}
