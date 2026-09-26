import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { cartao } from "@/lib/estilos";
import { calcularMetricasOrgao, classificarIndice } from "@/lib/reputacaoOrgao";

const STATUS_PUBLICOS = ["PUBLICADA", "EM_ANDAMENTO", "RESOLVIDA", "ARQUIVADA"] as const;
const LIMITE_ORGAOS = 100;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Transparencia");
  return { title: `${t("titulo")} · Urban Grid`, description: t("subtitulo") };
}

export default async function TransparenciaPage() {
  const t = await getTranslations("Transparencia");
  const tSelo = await getTranslations("Selo");

  const [totalPublicas, totalResolvidas, orgaos] = await Promise.all([
    prisma.reclamacao.count({ where: { status: { in: [...STATUS_PUBLICOS] } } }),
    prisma.reclamacao.count({ where: { status: "RESOLVIDA" } }),
    prisma.orgao.findMany({
      where: { ativo: true, respostas: { some: {} } },
      select: { id: true, nome: true, sigla: true, cidade: { select: { nome: true } } },
      take: LIMITE_ORGAOS,
    }),
  ]);

  const ranking = (
    await Promise.all(
      orgaos.map(async (orgao) => ({ orgao, metricas: await calcularMetricasOrgao(orgao.id) }))
    )
  ).sort(
    (a, b) =>
      (b.metricas.indiceResolucao ?? -1) - (a.metricas.indiceResolucao ?? -1) ||
      b.metricas.totalRespondidas - a.metricas.totalRespondidas
  );

  const totalRespondidas = ranking.reduce((soma, r) => soma + r.metricas.totalRespondidas, 0);
  const indiceGeral =
    totalPublicas > 0 ? Math.round((totalResolvidas / totalPublicas) * 100) : null;

  const resumo = [
    [t("publicas"), String(totalPublicas)],
    [t("resolvidas"), String(totalResolvidas)],
    [t("indiceGeral"), indiceGeral !== null ? `${indiceGeral}%` : "—"],
    [t("respondidasPorOrgaos"), String(totalRespondidas)],
  ];

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-6 sm:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {t("titulo")}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("subtitulo")}</p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {resumo.map(([rotulo, valor]) => (
          <div key={rotulo} className={`flex flex-col-reverse ${cartao}`}>
            <dt className="text-xs text-slate-500 dark:text-slate-400">{rotulo}</dt>
            <dd className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{valor}</dd>
          </div>
        ))}
      </dl>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {t("rankingTitulo")}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("rankingNota")}</p>

        {ranking.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("semDados")}</p>
        ) : (
          <div className={`overflow-x-auto p-0 ${cartao}`}>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">{t("colOrgao")}</th>
                  <th scope="col" className="px-4 py-2 font-medium">{t("colRespondidas")}</th>
                  <th scope="col" className="px-4 py-2 font-medium">{t("colResolucao")}</th>
                  <th scope="col" className="px-4 py-2 font-medium">{t("colTempo")}</th>
                  <th scope="col" className="px-4 py-2 font-medium">{t("colNota")}</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map(({ orgao, metricas }) => {
                  const selo = classificarIndice(metricas.indiceResolucao, metricas.totalRespondidas);
                  return (
                    <tr
                      key={orgao.id}
                      className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                    >
                      <th scope="row" className="px-4 py-3 font-normal">
                        <Link href={`/orgaos/${orgao.id}`} className="font-medium text-primary underline">
                          {orgao.sigla ?? orgao.nome}
                        </Link>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">
                          {orgao.cidade.nome}
                        </span>
                      </th>
                      <td className="px-4 py-3">{metricas.totalRespondidas}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${selo.className}`}
                        >
                          {metricas.indiceResolucao !== null ? `${metricas.indiceResolucao}%` : "—"}
                          {" · "}
                          {tSelo(selo.chave)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {metricas.tempoMedioRespostaDias !== null
                          ? `${metricas.tempoMedioRespostaDias}d`
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {metricas.notaMedia !== null ? `${metricas.notaMedia}/5` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
