import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/status-badge";
import { cartao, containerPagina } from "@/lib/estilos";
import { calcularMetricasOrgao, classificarIndice } from "@/lib/reputacaoOrgao";

function Metrica({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">{valor}</span>
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
    </div>
  );
}

export default async function OrgaoPage({ params }: PageProps<"/orgaos/[id]">) {
  const t = await getTranslations("OrgaoDetalhe");
  const tSelo = await getTranslations("Selo");
  const locale = await getLocale();
  const { id } = await params;

  const orgao = await prisma.orgao.findUnique({
    where: { id },
    include: { cidade: true },
  });
  if (!orgao) {
    notFound();
  }

  const [metricas, respostasRecentes] = await Promise.all([
    calcularMetricasOrgao(orgao.id),
    prisma.respostaOficial.findMany({
      where: { orgaoId: orgao.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { reclamacao: { select: { titulo: true, protocolo: true, status: true } } },
    }),
  ]);

  const classificacao = classificarIndice(metricas.indiceResolucao, metricas.totalRespondidas);

  return (
    <main className={containerPagina}>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {orgao.nome}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {orgao.sigla && `${orgao.sigla} · `}
          <Link href={`/cidades/${orgao.cidade.slug}`} className="text-primary underline">
            {orgao.cidade.nome}
          </Link>
          {!orgao.ativo && ` · ${t("orgaoInativo")}`}
        </p>
      </div>

      <div className={`flex flex-col gap-3 ${cartao}`}>
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-fit rounded-full px-2 py-0.5 text-xs font-medium ${classificacao.className}`}
          >
            {tSelo(classificacao.chave)}
          </span>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {t("reclamacoesRespondidas", { count: metricas.totalRespondidas })}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metrica
            label={t("resolvidas")}
            valor={metricas.indiceResolucao !== null ? `${metricas.indiceResolucao}%` : "—"}
          />
          <Metrica
            label={t("tempoMedioResposta")}
            valor={
              metricas.tempoMedioRespostaDias !== null
                ? `${metricas.tempoMedioRespostaDias}d`
                : "—"
            }
          />
          <Metrica
            label={t("notaCidadaos")}
            valor={metricas.notaMedia !== null ? `${metricas.notaMedia}/5` : "—"}
          />
          <Metrica label={t("avaliacoesRecebidas")} valor={String(metricas.totalAvaliacoes)} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {t("respostasRecentes")}
        </h2>

        {respostasRecentes.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("nenhumaResposta")}</p>
        )}

        {respostasRecentes.map((resposta) => (
          <Link
            key={resposta.id}
            href={`/reclamacoes/${resposta.reclamacao.protocolo}`}
            className={`flex flex-col gap-2 ${cartao} transition hover:border-primary hover:-translate-y-0.5 hover:shadow-md`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-slate-900 dark:text-slate-100">
                {resposta.reclamacao.titulo}
              </p>
              <StatusBadge status={resposta.reclamacao.status} />
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300">{resposta.texto}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {resposta.createdAt.toLocaleDateString(locale)}
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
