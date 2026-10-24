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
import { botaoSecundario, pagina } from "@/lib/estilos";
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
    <main className={pagina}>
      <CabecalhoPagina
        kicker={t("kicker")}
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

      <div className="flex max-w-4xl flex-col gap-6">
        {notificacoes.length === 0 ? (
          <EstadoVazio icone={BellOff} titulo={t("nenhuma")} descricao={t("nenhumaDesc")} />
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {notificacoes.map((notificacao) => {
              const Icone = ICONE_POR_TIPO[notificacao.tipo];
              return (
                <li
                  key={notificacao.id}
                  className={`flex items-start gap-4 px-3 py-5 sm:px-4 ${
                    notificacao.lida ? "" : "bg-brand-soft/50"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                      notificacao.lida ? "bg-sunken text-ink-muted" : "bg-brand text-on-brand"
                    }`}
                  >
                    <Icone className="h-4.5 w-4.5" />
                  </span>

                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className={notificacao.lida ? "font-semibold text-ink-2" : "font-bold text-ink"}>
                      {notificacao.titulo}
                      {!notificacao.lida && <span className="sr-only"> {t("naoLida")}</span>}
                    </p>
                    <p className="leading-relaxed text-ink-muted">{notificacao.mensagem}</p>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-ink-muted">
                      <time
                        dateTime={notificacao.createdAt.toISOString()}
                        title={formatarDataHora(notificacao.createdAt, locale)}
                        className="kicker"
                      >
                        {formatarTempoRelativo(notificacao.createdAt, locale)}
                      </time>
                      {notificacao.reclamacao && (
                        <Link
                          href={`/reclamacoes/${notificacao.reclamacao.protocolo}`}
                          className="font-semibold text-brand hover:underline"
                        >
                          {t("verReclamacao")}
                        </Link>
                      )}
                    </p>
                  </div>

                  {!notificacao.lida && (
                    <form action={marcarNotificacaoLida.bind(null, notificacao.id)}>
                      <button
                        type="submit"
                        className="shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold text-brand hover:bg-brand-soft"
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
      </div>
    </main>
  );
}
