import Link from "next/link";
import { History, UserCheck } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { DecisaoBadge } from "@/components/moderacao/decisao-badge";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Paginacao } from "@/components/ui/paginacao";
import { ResumoLateral } from "@/components/ui/resumo-lateral";
import { Secao } from "@/components/ui/secao";
import { GuiaPontuacoes } from "@/components/moderacao/guia-pontuacoes";
import { ChipsPontuacao, PontuacoesIA } from "@/components/moderacao/pontuacoes-ia";
import { calcularSkip, calcularTotalPaginas, ITENS_POR_PAGINA, lerPaginaAtual } from "@/lib/util/paginacao";
import {
  botaoSecundario,
  colunaLateral,
  colunaPrincipal,
  grade,
  pagina,
} from "@/lib/estilos";
import { formatarDataHora } from "@/lib/util/formatarData";
import { rotuloVersaoPrompt } from "@/lib/util/texto";
import { metadataDaPagina } from "@/lib/metadata";

import { exigirModerador } from "../exigir-moderador";

export const generateMetadata = metadataDaPagina("HistoricoModeracao");

const rotuloEixo = (rotulo: string) => rotulo.replace(/:\s*$/, "");

const ORDEM_DECISOES = ["APROVAR", "ENCAMINHAR_REVISAO", "REPROVAR"] as const;

export default async function HistoricoModeracaoPage({
  searchParams,
}: PageProps<"/moderacao/historico">) {
  const t = await getTranslations("HistoricoModeracao");
  const tDecisao = await getTranslations("Decisao");
  const tNav = await getTranslations("AdminNav");
  const locale = await getLocale();
  await exigirModerador();

  const { page } = await searchParams;
  const paginaAtual = lerPaginaAtual(page);
  const filtro = { alvoTipo: "RECLAMACAO" as const };

  const [logs, totalLogs, porDecisao, totalRevisadas] = await Promise.all([
    prisma.logModeracao.findMany({
      where: filtro,
      orderBy: { createdAt: "desc" },
      skip: calcularSkip(paginaAtual),
      take: ITENS_POR_PAGINA,
      include: { revisadoPor: true },
    }),
    prisma.logModeracao.count({ where: filtro }),
    prisma.logModeracao.groupBy({ by: ["decisao"], where: filtro, _count: { _all: true } }),
    prisma.logModeracao.count({ where: { ...filtro, decisaoFinal: { not: null } } }),
  ]);
  const totalPaginas = calcularTotalPaginas(totalLogs);
  const contagemPorDecisao = new Map(porDecisao.map((linha) => [linha.decisao, linha._count._all]));

  const reclamacoes = logs.length
    ? await prisma.reclamacao.findMany({
        where: { id: { in: logs.map((log) => log.alvoId) } },
        select: { id: true, protocolo: true, titulo: true, status: true },
      })
    : [];
  const reclamacaoPorId = new Map(reclamacoes.map((r) => [r.id, r]));

  return (
    <main className={pagina}>
      <CabecalhoPagina
        kicker={tNav("kickerModeracao")}
        titulo={t("titulo")}
        descricao={t("decisoesDesc")}
        acoes={
          <Link href="/moderacao/historico/comentarios" className={botaoSecundario}>
            <History className="h-4 w-4" aria-hidden />
            {t("historicoComentarios")}
          </Link>
        }
      />

      <div className={grade}>
        <div className={colunaPrincipal}>
          <Secao id="decisoes" titulo={t("secaoDecisoes")} contador={totalLogs}>
            {logs.length === 0 && <EstadoVazio icone={History} titulo={t("nenhumaDecisao")} />}

            {logs.length > 0 && (
              <ul className="-mt-2 divide-y divide-line">
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
                    <li key={log.id} className="flex flex-col gap-3 py-6">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-col gap-1">
                          {reclamacao ? (
                            <Link
                              href={`/reclamacoes/${reclamacao.protocolo}`}
                              className="font-bold text-ink hover:text-brand"
                            >
                              {reclamacao.titulo}
                            </Link>
                          ) : (
                            <p className="font-medium text-ink-muted">
                              {t("reclamacaoRemovida", { id: log.alvoId })}
                            </p>
                          )}
                          <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-ink-muted">
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
                        <p className="text-sm text-ink-2 italic">“{log.justificativa}”</p>
                      )}

                      <details className="group">
                        <summary className="w-fit cursor-pointer text-xs font-semibold text-brand underline underline-offset-2">
                          {t("todasPontuacoes")}
                        </summary>
                        <div className="mt-3">
                          <PontuacoesIA itens={pontuacoes} />
                        </div>
                      </details>

                      {log.decisaoFinal && (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-line pt-3 text-xs text-ink-muted">
                          <UserCheck className="h-3.5 w-3.5" aria-hidden />
                          <span>
                            {t("revisadoPor")}{" "}
                            <span className="font-medium text-ink-2">
                              {log.revisadoPor?.name ?? log.revisadoPor?.email ?? "—"}
                            </span>{" "}
                            {t("em")} {log.revisadoEm ? formatarDataHora(log.revisadoEm, locale) : "—"} →{" "}
                            {t("decisaoFinal")}
                          </span>
                          <DecisaoBadge decisao={log.decisaoFinal} origem={t("humano")} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <Paginacao
              paginaAtual={paginaAtual}
              totalPaginas={totalPaginas}
              basePath="/moderacao/historico"
            />
          </Secao>
        </div>

        <aside className={colunaLateral}>
          <ResumoLateral
            rotulo={t("resumoRotulo")}
            valor={totalLogs}
            itens={[
              ...ORDEM_DECISOES.map((decisao) => ({
                rotulo: tDecisao(decisao),
                valor: contagemPorDecisao.get(decisao) ?? 0,
              })),
              { rotulo: t("resumoRevisadas"), valor: totalRevisadas },
            ]}
          />
          <GuiaPontuacoes />
        </aside>
      </div>
    </main>
  );
}
