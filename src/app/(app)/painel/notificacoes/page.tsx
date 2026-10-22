import Link from "next/link";
import type { TipoNotificacao } from "@prisma/client";
import {
  BellOff,
  CircleCheck,
  CircleX,
  MessageSquare,
  MessageSquareText,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Star,
  type LucideIcon,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Paginacao } from "@/components/ui/paginacao";
import { marcarNotificacaoLida, marcarTodasLidas } from "@/components/layout/notificacoes-actions";
import { calcularSkip, calcularTotalPaginas, ITENS_POR_PAGINA, lerPaginaAtual } from "@/lib/util/paginacao";
import { formatarDataHora } from "@/lib/util/formatarData";
import { formatarTempoRelativo } from "@/lib/util/tempo-relativo";
import { botaoSecundario, cartao, containerPagina } from "@/lib/estilos";
import { exigirSessao } from "@/lib/seguranca/sessao";
import { metadataDaPagina } from "@/lib/metadata";

export const generateMetadata = metadataDaPagina("Notificacoes");

// O ícone diz de relance do que se trata, antes de ler o título.
const ICONE_POR_TIPO: Record<TipoNotificacao, LucideIcon> = {
  RECLAMACAO_PUBLICADA: CircleCheck,
  RECLAMACAO_REJEITADA: CircleX,
  RESPOSTA_OFICIAL: MessageSquareText,
  MUDANCA_STATUS: RefreshCw,
  NOVO_COMENTARIO: MessageSquare,
  PEDIDO_AVALIACAO: Star,
  ATIVIDADE_SUSPEITA: ShieldAlert,
  CONTA_SEGURANCA: ShieldCheck,
};

export default async function NotificacoesPage({
  searchParams,
}: PageProps<"/painel/notificacoes">) {
  const t = await getTranslations("Notificacoes");
  const locale = await getLocale();
  const session = await exigirSessao();

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
      <CabecalhoPagina
        titulo={t("titulo")}
        descricao={totalNotificacoes > 0 ? t("resumoNaoLidas", { count: totalNaoLidas }) : undefined}
        acoes={
          totalNaoLidas > 0 && (
            <form action={marcarTodasLidas}>
              <button type="submit" className={botaoSecundario}>
                {t("marcarTodasLidas")}
              </button>
            </form>
          )
        }
      />

      {notificacoes.length === 0 ? (
        <EstadoVazio icone={BellOff} titulo={t("nenhuma")} descricao={t("nenhumaDesc")} />
      ) : (
        <ul className={`divide-y divide-slate-200 overflow-hidden p-0 dark:divide-slate-800 ${cartao}`}>
          {notificacoes.map((notificacao) => {
            const Icone = ICONE_POR_TIPO[notificacao.tipo];
            return (
              <li
                key={notificacao.id}
                className={`flex items-start gap-3.5 px-4 py-4 ${
                  notificacao.lida ? "" : "bg-primary/5 dark:bg-primary/10"
                }`}
              >
                <span
                  aria-hidden
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    notificacao.lida
                      ? "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                      : "bg-blue-100 text-primary dark:bg-blue-950 dark:text-blue-300"
                  }`}
                >
                  <Icone className="h-4.5 w-4.5" />
                </span>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p
                    className={
                      notificacao.lida
                        ? "font-medium text-slate-700 dark:text-slate-300"
                        : "font-semibold text-slate-900 dark:text-slate-100"
                    }
                  >
                    {notificacao.titulo}
                    {!notificacao.lida && <span className="sr-only"> {t("naoLida")}</span>}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{notificacao.mensagem}</p>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-400 dark:text-slate-500">
                    <time
                      dateTime={notificacao.createdAt.toISOString()}
                      title={formatarDataHora(notificacao.createdAt, locale)}
                    >
                      {formatarTempoRelativo(notificacao.createdAt, locale)}
                    </time>
                    {notificacao.reclamacao && (
                      <>
                        <span aria-hidden>·</span>
                        <Link
                          href={`/reclamacoes/${notificacao.reclamacao.protocolo}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {t("verReclamacao")}
                        </Link>
                      </>
                    )}
                  </p>
                </div>

                {!notificacao.lida && (
                  <form action={marcarNotificacaoLida.bind(null, notificacao.id)}>
                    <button
                      type="submit"
                      className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                    >
                      {t("marcarComoLida")}
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Paginacao
        paginaAtual={paginaAtual}
        totalPaginas={totalPaginas}
        basePath="/painel/notificacoes"
      />
    </main>
  );
}
