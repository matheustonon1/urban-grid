import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageSquareText } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { Aviso } from "@/components/ui/aviso";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { PainelNumeros } from "@/components/ui/painel-numeros";
import { Secao } from "@/components/ui/secao";
import { StatusBadge } from "@/components/reclamacao/status-badge";
import { pagina } from "@/lib/estilos";
import { formatarDataHora } from "@/lib/util/formatarData";
import { calcularMetricasOrgao, classificarIndice } from "@/lib/orgaos/reputacaoOrgao";
import { formatarTempoRelativo } from "@/lib/util/tempo-relativo";

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
    <main className={pagina}>
      <CabecalhoPagina
        kicker={t("kicker")}
        titulo={orgao.nome}
        descricao={
          <>
            {orgao.sigla && `${orgao.sigla} · `}
            <Link href={`/cidades/${orgao.cidade.slug}`} className="text-brand hover:underline">
              {orgao.cidade.nome}
            </Link>
          </>
        }
        acoes={
          <>
            <span className="text-sm text-ink-muted">
              {t("reclamacoesRespondidas", { count: metricas.totalRespondidas })}
            </span>
            <span
              className={`inline-block rounded-[5px] px-2.5 py-1 text-sm font-semibold ${classificacao.className}`}
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

      <Secao id="respostas" titulo={t("respostasRecentes")} contador={respostasRecentes.length}>
        {respostasRecentes.length === 0 ? (
          <EstadoVazio icone={MessageSquareText} titulo={t("nenhumaResposta")} />
        ) : (
          <ul className="-mt-2 divide-y divide-line">
            {respostasRecentes.map((resposta) => (
              <li key={resposta.id}>
                <Link
                  href={`/reclamacoes/${resposta.reclamacao.protocolo}`}
                  className="group flex flex-col gap-2 py-5 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-lg leading-snug font-bold text-ink transition-colors group-hover:text-brand">
                      {resposta.reclamacao.titulo}
                    </p>
                    <StatusBadge status={resposta.reclamacao.status} />
                  </div>
                  <p className="line-clamp-3 max-w-3xl leading-relaxed text-ink-2">{resposta.texto}</p>
                  <time
                    dateTime={resposta.createdAt.toISOString()}
                    title={formatarDataHora(resposta.createdAt, locale)}
                    className="kicker"
                  >
                    {formatarTempoRelativo(resposta.createdAt, locale)}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Secao>
    </main>
  );
}
