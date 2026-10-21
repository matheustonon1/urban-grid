import Link from "next/link";
import { History, UserCheck } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { DecisaoBadge } from "@/components/decisao-badge";
import { EstadoVazio } from "@/components/estado-vazio";
import { Paginacao } from "@/components/paginacao";
import { ChipsPontuacao, PontuacoesIA } from "@/components/pontuacoes-ia";
import { calcularSkip, calcularTotalPaginas, ITENS_POR_PAGINA, lerPaginaAtual } from "@/lib/paginacao";
import { botaoSecundario, cartao, containerPagina } from "@/lib/estilos";
import { formatarDataHora } from "@/lib/formatarData";
import { rotuloVersaoPrompt } from "@/lib/texto";
import { metadataDaPagina } from "@/lib/metadata";

import { exigirModerador } from "../exigir-moderador";

export const generateMetadata = metadataDaPagina("HistoricoModeracao");

const rotuloEixo = (rotulo: string) => rotulo.replace(/:\s*$/, "");

export default async function HistoricoModeracaoPage({
  searchParams,
}: PageProps<"/moderacao/historico">) {
  const t = await getTranslations("HistoricoModeracao");
  const locale = await getLocale();
  await exigirModerador();

  const { page } = await searchParams;
  const paginaAtual = lerPaginaAtual(page);
  const filtro = { alvoTipo: "RECLAMACAO" as const };

  const [logs, totalLogs] = await Promise.all([
    prisma.logModeracao.findMany({
      where: filtro,
      orderBy: { createdAt: "desc" },
      skip: calcularSkip(paginaAtual),
      take: ITENS_POR_PAGINA,
      include: { revisadoPor: true },
    }),
    prisma.logModeracao.count({ where: filtro }),
  ]);
  const totalPaginas = calcularTotalPaginas(totalLogs);

  const reclamacoes = logs.length
    ? await prisma.reclamacao.findMany({
        where: { id: { in: logs.map((log) => log.alvoId) } },
        select: { id: true, protocolo: true, titulo: true, status: true },
      })
    : [];
  const reclamacaoPorId = new Map(reclamacoes.map((r) => [r.id, r]));

  return (
    <main className={`${containerPagina} max-w-3xl`}>
      <CabecalhoPagina
        titulo={t("titulo")}
        descricao={`${t("decisoesDesc")}${totalLogs > 0 ? ` (${totalLogs})` : ""}`}
        acoes={
          <Link href="/moderacao/historico/comentarios" className={botaoSecundario}>
            <History className="h-4 w-4" aria-hidden />
            {t("historicoComentarios")}
          </Link>
        }
      />

      {logs.length === 0 && <EstadoVazio icone={History} titulo={t("nenhumaDecisao")} />}

      {logs.map((log) => {
        const reclamacao = reclamacaoPorId.get(log.alvoId);
        const pontuacoes = [
          { rotulo: rotuloEixo(t("geral")), valor: log.scoreGeral, destaque: true },
          { rotulo: t("ofensivo"), valor: log.scoreOfensivo },
          { rotulo: t("spam"), valor: log.scoreSpam },
          { rotulo: t("dadosPessoais"), valor: log.scoreDadosPessoais },
          { rotulo: t("foraDeEscopo"), valor: log.scoreForaEscopo },
          { rotulo: t("desinformacao"), valor: log.scoreDesinformacao },
          { rotulo: t("coerenciaTextoImagem"), valor: log.coerenciaTextoImagem, invertido: true },
        ];

        return (
          <div key={log.id} className={`flex flex-col gap-3 ${cartao}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                {reclamacao ? (
                  <Link
                    href={`/reclamacoes/${reclamacao.protocolo}`}
                    className="font-semibold text-slate-900 hover:text-primary dark:text-slate-100"
                  >
                    {reclamacao.titulo}
                  </Link>
                ) : (
                  <p className="font-medium text-slate-400 dark:text-slate-500">
                    {t("reclamacaoRemovida", { id: log.alvoId })}
                  </p>
                )}
                <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500 dark:text-slate-400">
                  {reclamacao && <span className="font-mono">{reclamacao.protocolo}</span>}
                  {reclamacao && <span aria-hidden>·</span>}
                  <time dateTime={log.createdAt.toISOString()}>
                    {formatarDataHora(log.createdAt, locale)}
                  </time>
                  <span aria-hidden>·</span>
                  <span>{rotuloVersaoPrompt(log.versaoPrompt)}</span>
                  {log.latenciaMs != null && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="tabular-nums">{log.latenciaMs}ms</span>
                    </>
                  )}
                </p>
              </div>
              <DecisaoBadge decisao={log.decisao} origem={t("ia")} />
            </div>

            <ChipsPontuacao itens={pontuacoes} vazio={t("nenhumEixoAlto")} />

            {log.justificativa && (
              <p className="text-sm text-slate-600 italic dark:text-slate-300">
                “{log.justificativa}”
              </p>
            )}

            <details className="group">
              <summary className="w-fit cursor-pointer text-xs font-medium text-primary hover:underline">
                {t("todasPontuacoes")}
              </summary>
              <div className="mt-3">
                <PontuacoesIA itens={pontuacoes} />
              </div>
            </details>

            {log.decisaoFinal && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <UserCheck className="h-3.5 w-3.5" aria-hidden />
                <span>
                  {t("revisadoPor")}{" "}
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {log.revisadoPor?.name ?? log.revisadoPor?.email ?? "—"}
                  </span>{" "}
                  {t("em")} {log.revisadoEm ? formatarDataHora(log.revisadoEm, locale) : "—"} →{" "}
                  {t("decisaoFinal")}
                </span>
                <DecisaoBadge decisao={log.decisaoFinal} origem={t("humano")} />
              </div>
            )}
          </div>
        );
      })}

      <Paginacao
        paginaAtual={paginaAtual}
        totalPaginas={totalPaginas}
        basePath="/moderacao/historico"
      />
    </main>
  );
}
