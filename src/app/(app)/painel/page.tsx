import Link from "next/link";
import { ChevronRight, FilePlus, Plus, Users } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/lib/seguranca/sessao";
import { Aviso } from "@/components/ui/aviso";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { PainelNumeros } from "@/components/ui/painel-numeros";
import { StatusBadge } from "@/components/reclamacao/status-badge";
import { Paginacao } from "@/components/ui/paginacao";
import { calcularSkip, calcularTotalPaginas, ITENS_POR_PAGINA, lerPaginaAtual } from "@/lib/util/paginacao";
import { botaoPrimario, botaoSecundario, cartao, containerMedio } from "@/lib/estilos";
import { metadataDaPagina } from "@/lib/metadata";
import { formatarTempoRelativo } from "@/lib/util/tempo-relativo";

import { reenviarVerificacao } from "./actions";

export const generateMetadata = metadataDaPagina("Painel");

export default async function PainelPage({ searchParams }: PageProps<"/painel">) {
  const t = await getTranslations("Painel");
  const tPapel = await getTranslations("Papel");
  const locale = await getLocale();
  const session = await exigirSessao();

  const { page } = await searchParams;
  const paginaAtual = lerPaginaAtual(page);
  const filtro = { autorId: session.user.id };

  const [reclamacoes, totalReclamacoes, porStatus, confirmacoesRecebidas, usuario] =
    await Promise.all([
      prisma.reclamacao.findMany({
        where: filtro,
        orderBy: { createdAt: "desc" },
        skip: calcularSkip(paginaAtual),
        take: ITENS_POR_PAGINA,
        include: { _count: { select: { confirmacoes: true } } },
      }),
      prisma.reclamacao.count({ where: filtro }),
      prisma.reclamacao.groupBy({ by: ["status"], where: filtro, _count: { _all: true } }),
      prisma.confirmacao.count({ where: { reclamacao: filtro } }),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { emailVerified: true },
      }),
    ]);
  const totalPaginas = calcularTotalPaginas(totalReclamacoes);

  const contagem = (status: string) =>
    porStatus.find((grupo) => grupo.status === status)?._count._all ?? 0;
  const primeiroNome = session.user.name?.trim().split(/\s+/)[0];

  const novaReclamacao = (
    <Link href="/reclamacoes/nova" className={botaoPrimario}>
      <Plus className="h-4 w-4" aria-hidden />
      {t("novaReclamacao")}
    </Link>
  );

  return (
    <main className={containerMedio}>
      <CabecalhoPagina
        titulo={primeiroNome ? t("ola", { nome: primeiroNome }) : t("titulo")}
        descricao={`${tPapel(session.user.papel)} · ${session.user.email}`}
        acoes={totalReclamacoes > 0 ? novaReclamacao : undefined}
      />

      {!usuario?.emailVerified && (
        <Aviso
          tom="atencao"
          acao={
            <form action={reenviarVerificacao}>
              <button type="submit" className={botaoSecundario}>
                {t("reenviarVerificacao")}
              </button>
            </form>
          }
        >
          {t("emailNaoVerificado")}
        </Aviso>
      )}

      {totalReclamacoes > 0 && (
        <PainelNumeros
          itens={[
            { rotulo: t("metricaTotal"), valor: String(totalReclamacoes) },
            { rotulo: t("metricaAndamento"), valor: String(contagem("EM_ANDAMENTO")) },
            { rotulo: t("metricaResolvidas"), valor: String(contagem("RESOLVIDA")) },
            { rotulo: t("metricaConfirmacoes"), valor: String(confirmacoesRecebidas) },
          ]}
        />
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {t("minhasReclamacoes")}
        </h2>

        {reclamacoes.length === 0 ? (
          <EstadoVazio
            icone={FilePlus}
            titulo={t("nenhumaReclamacao")}
            descricao={t("nenhumaReclamacaoDesc")}
          >
            {novaReclamacao}
          </EstadoVazio>
        ) : (
          <ul className={`divide-y divide-slate-200 overflow-hidden p-0 dark:divide-slate-800 ${cartao}`}>
            {reclamacoes.map((reclamacao) => (
              <li key={reclamacao.id}>
                <Link
                  href={`/reclamacoes/${reclamacao.protocolo}`}
                  className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 dark:hover:bg-slate-800/50 dark:focus-visible:bg-slate-800/50"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="sm:hidden">
                      <StatusBadge status={reclamacao.status} />
                    </div>
                    <p className="line-clamp-2 font-medium text-slate-900 group-hover:text-primary sm:line-clamp-1 dark:text-slate-100">
                      {reclamacao.titulo}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono">{reclamacao.protocolo}</span>
                      <span aria-hidden>·</span>
                      <span>{formatarTempoRelativo(reclamacao.createdAt, locale)}</span>
                      {reclamacao._count.confirmacoes > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" aria-hidden />
                          <span className="tabular-nums">{reclamacao._count.confirmacoes}</span>
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="hidden sm:block">
                    <StatusBadge status={reclamacao.status} />
                  </div>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-primary dark:text-slate-600"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}

        <Paginacao paginaAtual={paginaAtual} totalPaginas={totalPaginas} basePath="/painel" />
      </section>
    </main>
  );
}
