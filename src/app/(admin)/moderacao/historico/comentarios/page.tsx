import Link from "next/link";
import { History, UserCheck } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { DecisaoBadge } from "@/components/moderacao/decisao-badge";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Paginacao } from "@/components/ui/paginacao";
import { ChipsPontuacao, PontuacoesIA } from "@/components/moderacao/pontuacoes-ia";
import { calcularSkip, calcularTotalPaginas, ITENS_POR_PAGINA, lerPaginaAtual } from "@/lib/util/paginacao";
import { botaoSecundario, cartao, containerPagina } from "@/lib/estilos";
import { formatarDataHora } from "@/lib/util/formatarData";
import { rotuloVersaoPrompt } from "@/lib/util/texto";
import { metadataDaPagina } from "@/lib/metadata";

import { exigirModerador } from "../../exigir-moderador";

export const generateMetadata = metadataDaPagina("HistoricoComentarios");

const rotuloEixo = (rotulo: string) => rotulo.replace(/:\s*$/, "");

export default async function HistoricoModeracaoComentariosPage({
  searchParams,
}: PageProps<"/moderacao/historico/comentarios">) {
  const t = await getTranslations("HistoricoComentarios");
  const tHist = await getTranslations("HistoricoModeracao");
  const locale = await getLocale();
  await exigirModerador();

  const { page } = await searchParams;
  const paginaAtual = lerPaginaAtual(page);
  const filtro = { alvoTipo: "COMENTARIO" as const };

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

  const comentarios = logs.length
    ? await prisma.comentario.findMany({
        where: { id: { in: logs.map((log) => log.alvoId) } },
        include: { reclamacao: { select: { protocolo: true, titulo: true } } },
      })
    : [];
  const comentarioPorId = new Map(comentarios.map((c) => [c.id, c]));

  return (
    <main className={`${containerPagina} max-w-3xl`}>
      <CabecalhoPagina
        titulo={t("titulo")}
        descricao={`${tHist("decisoesDesc")}${totalLogs > 0 ? ` (${totalLogs})` : ""}`}
        acoes={
          <Link href="/moderacao/comentarios" className={botaoSecundario}>
            <History className="h-4 w-4" aria-hidden />
            {t("pendentesDeRevisao")}
          </Link>
        }
      />

      {logs.length === 0 && <EstadoVazio icone={History} titulo={tHist("nenhumaDecisao")} />}

      {logs.map((log) => {
        const comentario = comentarioPorId.get(log.alvoId);
        const pontuacoes = [
          { rotulo: rotuloEixo(tHist("geral")), valor: log.scoreGeral, destaque: true },
          { rotulo: tHist("ofensivo"), valor: log.scoreOfensivo },
          { rotulo: tHist("spam"), valor: log.scoreSpam },
          { rotulo: tHist("dadosPessoais"), valor: log.scoreDadosPessoais },
        ];

        return (
          <div key={log.id} className={`flex flex-col gap-3 ${cartao}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                {comentario ? (
                  <Link
                    href={`/reclamacoes/${comentario.reclamacao.protocolo}`}
                    className="font-semibold text-slate-900 hover:text-primary dark:text-slate-100"
                  >
                    {comentario.texto.length > 80
                      ? `${comentario.texto.slice(0, 80)}…`
                      : comentario.texto}
                  </Link>
                ) : (
                  <p className="font-medium text-slate-400 dark:text-slate-500">
                    {t("comentarioRemovido", { id: log.alvoId })}
                  </p>
                )}
                <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500 dark:text-slate-400">
                  {comentario && (
                    <>
                      <span>{t("emReclamacao", { titulo: comentario.reclamacao.titulo })}</span>
                      <span aria-hidden>·</span>
                    </>
                  )}
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
              <DecisaoBadge decisao={log.decisao} origem={tHist("ia")} />
            </div>

            <ChipsPontuacao itens={pontuacoes} vazio={tHist("nenhumEixoAlto")} />

            {log.justificativa && (
              <p className="text-sm text-slate-600 italic dark:text-slate-300">
                “{log.justificativa}”
              </p>
            )}

            <details>
              <summary className="w-fit cursor-pointer text-xs font-medium text-primary hover:underline">
                {tHist("todasPontuacoes")}
              </summary>
              <div className="mt-3">
                <PontuacoesIA itens={pontuacoes} />
              </div>
            </details>

            {log.decisaoFinal && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <UserCheck className="h-3.5 w-3.5" aria-hidden />
                <span>
                  {tHist("revisadoPor")}{" "}
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {log.revisadoPor?.name ?? log.revisadoPor?.email ?? "—"}
                  </span>{" "}
                  {tHist("em")} {log.revisadoEm ? formatarDataHora(log.revisadoEm, locale) : "—"} →{" "}
                  {tHist("decisaoFinal")}
                </span>
                <DecisaoBadge decisao={log.decisaoFinal} origem={tHist("humano")} />
              </div>
            )}
          </div>
        );
      })}

      <Paginacao
        paginaAtual={paginaAtual}
        totalPaginas={totalPaginas}
        basePath="/moderacao/historico/comentarios"
      />
    </main>
  );
}
