import type { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { PainelNumeros } from "@/components/ui/painel-numeros";
import { Secao } from "@/components/ui/secao";
import { pagina } from "@/lib/estilos";
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
    <main className={pagina}>
      <CabecalhoPagina kicker={t("kicker")} titulo={t("titulo")} descricao={t("subtitulo")} />

      <PainelNumeros itens={resumo} />

      <Secao
        id="ranking"
        titulo={t("rankingTitulo")}
        contador={ranking.length}
        descricao={t("rankingNota")}
      >
        {ranking.length === 0 ? (
          <EstadoVazio icone={Building2} titulo={t("semDados")} />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-sunken/60">
                <tr>
                  <th scope="col" className="kicker px-4 py-3">
                    {t("colOrgao")}
                  </th>
                  <th scope="col" className="kicker px-4 py-3">
                    {t("colRespondidas")}
                  </th>
                  <th scope="col" className="kicker px-4 py-3">
                    {t("colResolucao")}
                  </th>
                  <th scope="col" className="kicker px-4 py-3">
                    {t("colTempo")}
                  </th>
                  <th scope="col" className="kicker px-4 py-3">
                    {t("colNota")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {ranking.map(({ orgao, metricas }, indice) => {
                  const selo = classificarIndice(metricas.indiceResolucao, metricas.totalRespondidas);
                  return (
                    <tr
                      key={orgao.id}
                      className="border-b border-line transition-colors last:border-0 hover:bg-sunken/50"
                    >
                      <th scope="row" className="px-4 py-3.5 font-normal">
                        <div className="flex items-center gap-3">
                          <span aria-hidden className="w-6 shrink-0 font-mono text-base text-ink-faint tabular-nums">
                            {String(indice + 1).padStart(2, "0")}
                          </span>
                          <div className="min-w-0">
                            <Link
                              href={`/orgaos/${orgao.id}`}
                              className="font-bold text-ink hover:text-brand hover:underline"
                            >
                              {orgao.sigla ?? orgao.nome}
                            </Link>
                            <span className="block text-xs text-ink-muted">{orgao.cidade.nome}</span>
                          </div>
                        </div>
                      </th>
                      <td className="px-4 py-3.5 font-mono tabular-nums">{metricas.totalRespondidas}</td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-block rounded-[5px] px-2 py-0.5 text-xs font-semibold ${selo.className}`}
                        >
                          {metricas.indiceResolucao !== null ? `${metricas.indiceResolucao}%` : "—"}
                          {" · "}
                          {tSelo(selo.chave)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono tabular-nums">
                        {metricas.tempoMedioRespostaDias !== null
                          ? `${metricas.tempoMedioRespostaDias}d`
                          : "—"}
                      </td>
                      <td className="px-4 py-3.5 font-mono tabular-nums">
                        {metricas.notaMedia !== null ? `${metricas.notaMedia}/5` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Secao>
    </main>
  );
}
