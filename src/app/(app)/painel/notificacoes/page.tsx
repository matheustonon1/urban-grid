import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Paginacao } from "@/components/paginacao";
import { marcarNotificacaoLida, marcarTodasLidas } from "@/components/notificacoes-actions";
import { calcularSkip, calcularTotalPaginas, ITENS_POR_PAGINA, lerPaginaAtual } from "@/lib/paginacao";
import { formatarTempoRelativo } from "@/lib/tempo-relativo";
import { botaoSecundario, cartao, containerPagina } from "@/lib/estilos";

export default async function NotificacoesPage({
  searchParams,
}: PageProps<"/painel/notificacoes">) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { page } = await searchParams;
  const paginaAtual = lerPaginaAtual(page);
  const filtro = { userId: session.user.id };

  const [notificacoes, totalNotificacoes, totalNaoLidas] = await Promise.all([
    prisma.notificacao.findMany({
      where: filtro,
      orderBy: { createdAt: "desc" },
      skip: calcularSkip(paginaAtual),
      take: ITENS_POR_PAGINA,
      include: { reclamacao: { select: { protocolo: true } } },
    }),
    prisma.notificacao.count({ where: filtro }),
    prisma.notificacao.count({ where: { ...filtro, lida: false } }),
  ]);
  const totalPaginas = calcularTotalPaginas(totalNotificacoes);

  return (
    <main className={containerPagina}>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Notificações {totalNotificacoes > 0 && `(${totalNotificacoes})`}
        </h1>
        {totalNaoLidas > 0 && (
          <form action={marcarTodasLidas}>
            <button type="submit" className={botaoSecundario}>
              Marcar todas como lidas
            </button>
          </form>
        )}
      </div>

      {notificacoes.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Nenhuma notificação ainda.
        </p>
      )}

      {notificacoes.map((notificacao) => (
        <div
          key={notificacao.id}
          className={`flex items-start justify-between gap-3 ${cartao} ${
            notificacao.lida ? "" : "border-primary/40 bg-blue-50/50 dark:bg-blue-950/30"
          }`}
        >
          <div className="flex flex-col gap-1">
            <p className="font-medium text-slate-900 dark:text-slate-100">
              {notificacao.titulo}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">{notificacao.mensagem}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
              <span>{formatarTempoRelativo(notificacao.createdAt)}</span>
              {notificacao.reclamacao && (
                <>
                  ·{" "}
                  <Link
                    href={`/reclamacoes/${notificacao.reclamacao.protocolo}`}
                    className="text-primary underline"
                  >
                    Ver reclamação
                  </Link>
                </>
              )}
            </div>
          </div>

          {!notificacao.lida && (
            <form action={marcarNotificacaoLida.bind(null, notificacao.id)}>
              <button type="submit" className="shrink-0 text-xs text-primary hover:underline">
                Marcar como lida
              </button>
            </form>
          )}
        </div>
      ))}

      <Paginacao
        paginaAtual={paginaAtual}
        totalPaginas={totalPaginas}
        basePath="/painel/notificacoes"
      />
    </main>
  );
}
