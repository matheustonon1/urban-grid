import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { Marca } from "@/components/ui/marca";
import { prisma } from "@/lib/prisma";
import { botaoPrimario } from "@/lib/estilos";

import { BuscaCidadeHeader, BuscaCidadeMobile } from "./busca-cidade-header";
import { LinkNav } from "./link-nav";
import { NotificacoesSino } from "./notificacoes-sino";
import { SeletorIdioma } from "./seletor-idioma";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export async function SiteHeader() {
  const t = await getTranslations("Header");
  const session = await auth();
  const ehModerador =
    session?.user?.papel === "MODERADOR" || session?.user?.papel === "ADMIN";
  const ehOrgao = session?.user?.papel === "ORGAO";
  const ehAdmin = session?.user?.papel === "ADMIN";

  const [usuario, notificacoes, totalNaoLidas] = await Promise.all([
    session?.user
      ? prisma.user.findUnique({
          where: { id: session.user.id },
          select: { name: true, email: true },
        })
      : null,
    session?.user
      ? prisma.notificacao.findMany({
          where: { userId: session.user.id },
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { reclamacao: { select: { protocolo: true } } },
        })
      : [],
    session?.user
      ? prisma.notificacao.count({
          where: { userId: session.user.id, lida: false },
        })
      : 0,
  ]);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur-md">
      {/* relative: o painel de busca do celular se ancora neste container. */}
      <div className="relative mx-auto flex h-16 max-w-6xl items-center gap-2 px-3 sm:gap-6 sm:px-8">
        <Link href="/" aria-label="Urban Grid" className="shrink-0">
          <Marca />
        </Link>

        <nav aria-label={t("principal")} className="hidden h-full items-stretch sm:flex">
          <LinkNav href="/reclamacoes">{t("reclamacoes")}</LinkNav>
          <LinkNav href="/transparencia" className="hidden md:inline-flex">
            {t("transparencia")}
          </LinkNav>
        </nav>

        <BuscaCidadeHeader />

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <BuscaCidadeMobile />

          {usuario ? (
            <>
              <NotificacoesSino
                notificacoes={notificacoes.map((notificacao) => ({
                  id: notificacao.id,
                  titulo: notificacao.titulo,
                  mensagem: notificacao.mensagem,
                  lida: notificacao.lida,
                  createdAt: notificacao.createdAt,
                  protocolo: notificacao.reclamacao?.protocolo ?? null,
                }))}
                totalNaoLidas={totalNaoLidas}
              />
              <UserMenu
                nome={usuario.name ?? usuario.email}
                email={usuario.email}
                ehModerador={ehModerador}
                ehOrgao={ehOrgao}
                ehAdmin={ehAdmin}
              />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-md px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink sm:inline"
              >
                {t("entrar")}
              </Link>
              <Link href="/cadastro" className={`${botaoPrimario} px-3 py-1.5 sm:px-4 sm:py-2`}>
                {t("cadastrar")}
              </Link>
            </>
          )}

          <SeletorIdioma />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
