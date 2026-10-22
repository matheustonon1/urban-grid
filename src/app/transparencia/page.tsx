import type { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { PainelNumeros } from "@/components/ui/painel-numeros";
import { cartao, containerLargo } from "@/lib/estilos";
import { calcularMetricasOrgao, classificarIndice } from "@/lib/orgaos/reputacaoOrgao";
import { STATUS_PUBLICOS } from "@/lib/reclamacoes/statusPublicos";

const LIMITE_ORGAOS = 100;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Transparencia");
  return { title: t("titulo"), description: t("subtitulo") };
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
    { rotulo: t("publicas"), valor: String(totalPublicas) },
    { rotulo: t("resolvidas"), valor: String(totalResolvidas) },
    { rotulo: t("indiceGeral"), valor: indiceGeral !== null ? `${indiceGeral}%` : "—" },
    { rotulo: t("respondidasPorOrgaos"), valor: String(totalRespondidas) },
  ];

  return (
    <main className={containerLargo}>
      <CabecalhoPagina titulo={t("titulo")} descricao={t("subtitulo")} />

      <PainelNumeros itens={resumo} />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {t("rankingTitulo")}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("rankingNota")}</p>

        {ranking.length === 0 ? (
          <EstadoVazio icone={Building2} titulo={t("semDados")} />
        ) : (
          <div className={`overflow-x-auto p-0 ${cartao}`}>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
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
                      className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40"
                    >
                      <th scope="row" className="px-4 py-3 font-normal">
                        <Link href={`/orgaos/${orgao.id}`} className="font-medium text-primary hover:underline">
                          {orgao.sigla ?? orgao.nome}
                        </Link>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">
                          {orgao.cidade.nome}
                        </span>
                      </th>
                      <td className="px-4 py-3 tabular-nums">{metricas.totalRespondidas}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${selo.className}`}
                        >
                          {metricas.indiceResolucao !== null ? `${metricas.indiceResolucao}%` : "—"}
                          {" · "}
                          {tSelo(selo.chave)}
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {metricas.tempoMedioRespostaDias !== null
                          ? `${metricas.tempoMedioRespostaDias}d`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
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
