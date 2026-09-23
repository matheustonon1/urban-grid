import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/status-badge";
import { Paginacao } from "@/components/paginacao";
import { calcularSkip, calcularTotalPaginas, ITENS_POR_PAGINA, lerPaginaAtual } from "@/lib/paginacao";
import { botaoPrimario, botaoSecundario, cartao, containerPagina } from "@/lib/estilos";

import { reenviarVerificacao } from "./actions";

export default async function PainelPage({ searchParams }: PageProps<"/painel">) {
  const t = await getTranslations("Painel");
  const tPapel = await getTranslations("Papel");
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { page } = await searchParams;
  const paginaAtual = lerPaginaAtual(page);
  const filtro = { autorId: session.user.id };

  const [reclamacoes, totalReclamacoes, usuario] = await Promise.all([
    prisma.reclamacao.findMany({
      where: filtro,
      orderBy: { createdAt: "desc" },
      skip: calcularSkip(paginaAtual),
      take: ITENS_POR_PAGINA,
    }),
    prisma.reclamacao.count({ where: filtro }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { emailVerified: true },
    }),
  ]);
  const totalPaginas = calcularTotalPaginas(totalReclamacoes);

  return (
    <main className={containerPagina}>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        {t("titulo")}
      </h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {t("logadoComo")} <strong>{session.user.email}</strong> ({tPapel(session.user.papel)})
      </p>

      {!usuario?.emailVerified && (
        <div className={`flex items-center justify-between gap-3 ${cartao}`}>
          <p className="text-sm text-amber-700 dark:text-amber-400">{t("emailNaoVerificado")}</p>
          <form action={reenviarVerificacao}>
            <button type="submit" className={botaoSecundario}>
              {t("reenviarVerificacao")}
            </button>
          </form>
        </div>
      )}

      <Link href="/reclamacoes/nova" className={`${botaoPrimario} w-fit`}>
        {t("novaReclamacao")}
      </Link>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {t("minhasReclamacoes")}
        </h2>
        {reclamacoes.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("nenhumaReclamacao")}</p>
        )}
        {reclamacoes.map((reclamacao) => (
          <Link
            key={reclamacao.id}
            href={`/reclamacoes/${reclamacao.protocolo}`}
            className={`flex items-center justify-between gap-2 ${cartao} transition hover:border-primary`}
          >
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">{reclamacao.titulo}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{reclamacao.protocolo}</p>
            </div>
            <StatusBadge status={reclamacao.status} />
          </Link>
        ))}

        <Paginacao paginaAtual={paginaAtual} totalPaginas={totalPaginas} basePath="/painel" />
      </div>
    </main>
  );
}
