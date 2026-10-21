import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageSquareText } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { Aviso } from "@/components/aviso";
import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { EstadoVazio } from "@/components/estado-vazio";
import { PainelNumeros } from "@/components/painel-numeros";
import { StatusBadge } from "@/components/status-badge";
import { containerMedio } from "@/lib/estilos";
import { formatarDataHora } from "@/lib/formatarData";
import { calcularMetricasOrgao, classificarIndice } from "@/lib/reputacaoOrgao";
import { formatarTempoRelativo } from "@/lib/tempo-relativo";

// Mesma consulta pra página e pro generateMetadata, uma ida ao banco só.
const buscarOrgao = cache((id: string) =>
  prisma.orgao.findUnique({ where: { id }, include: { cidade: true } })
);

export async function generateMetadata({ params }: PageProps<"/orgaos/[id]">): Promise<Metadata> {
  const { id } = await params;
  const orgao = await buscarOrgao(id);
  return { title: orgao ? orgao.nome : undefined };
}

export default async function OrgaoPage({ params }: PageProps<"/orgaos/[id]">) {
  const t = await getTranslations("OrgaoDetalhe");
  const tSelo = await getTranslations("Selo");
  const locale = await getLocale();
  const { id } = await params;

  const orgao = await buscarOrgao(id);
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
    <main className={containerMedio}>
      <CabecalhoPagina
        titulo={orgao.nome}
        descricao={
          <>
            {orgao.sigla && `${orgao.sigla} · `}
            <Link href={`/cidades/${orgao.cidade.slug}`} className="text-primary hover:underline">
              {orgao.cidade.nome}
            </Link>
          </>
        }
        acoes={
          <>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {t("reclamacoesRespondidas", { count: metricas.totalRespondidas })}
            </span>
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${classificacao.className}`}
            >
              {tSelo(classificacao.chave)}
            </span>
          </>
        }
      />

      {!orgao.ativo && <Aviso tom="info">{t("orgaoInativo")}</Aviso>}

      <PainelNumeros
        itens={[
          {
            rotulo: t("resolvidas"),
            valor: metricas.indiceResolucao !== null ? `${metricas.indiceResolucao}%` : "—",
          },
          {
            rotulo: t("tempoMedioResposta"),
            valor:
              metricas.tempoMedioRespostaDias !== null ? `${metricas.tempoMedioRespostaDias}d` : "—",
          },
          {
            rotulo: t("notaCidadaos"),
            valor: metricas.notaMedia !== null ? `${metricas.notaMedia}/5` : "—",
          },
          { rotulo: t("avaliacoesRecebidas"), valor: String(metricas.totalAvaliacoes) },
        ]}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {t("respostasRecentes")}
        </h2>

        {respostasRecentes.length === 0 ? (
          <EstadoVazio icone={MessageSquareText} titulo={t("nenhumaResposta")} />
        ) : (
          <ul className="flex flex-col gap-3">
            {respostasRecentes.map((resposta) => (
              <li key={resposta.id}>
                <Link
                  href={`/reclamacoes/${resposta.reclamacao.protocolo}`}
                  className="group flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-400/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold leading-snug text-slate-900 transition-colors group-hover:text-primary dark:text-slate-100">
                      {resposta.reclamacao.titulo}
                    </p>
                    <StatusBadge status={resposta.reclamacao.status} />
                  </div>
                  <p className="line-clamp-3 text-sm text-slate-600 dark:text-slate-300">
                    {resposta.texto}
                  </p>
                  <time
                    dateTime={resposta.createdAt.toISOString()}
                    title={formatarDataHora(resposta.createdAt, locale)}
                    className="text-xs text-slate-400 dark:text-slate-500"
                  >
                    {formatarTempoRelativo(resposta.createdAt, locale)}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
