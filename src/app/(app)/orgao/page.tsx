import Link from "next/link";
import { StatusReclamacao } from "@prisma/client";
import { getLocale, getTranslations } from "next-intl/server";
import { CircleCheck, MessageSquareText } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/reclamacao/status-badge";
import { Paginacao } from "@/components/ui/paginacao";
import { calcularSkip, calcularTotalPaginas, ITENS_POR_PAGINA, lerPaginaAtual } from "@/lib/util/paginacao";
import { botaoPrimario, campoInput, cartao, containerPagina } from "@/lib/estilos";
import { calcularMetricasOrgao, classificarIndice } from "@/lib/orgaos/reputacaoOrgao";
import { metadataDaPagina } from "@/lib/metadata";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { PainelNumeros } from "@/components/ui/painel-numeros";

import { responderReclamacao } from "../reclamacoes/[protocolo]/actions";
import { exigirOrgao } from "../reclamacoes/[protocolo]/exigir-orgao";

export const generateMetadata = metadataDaPagina("PainelOrgao");

export default async function PainelOrgaoPage({ searchParams }: PageProps<"/orgao">) {
  const t = await getTranslations("PainelOrgao");
  const tResp = await getTranslations("ReclamacaoDetalhe");
  const tSelo = await getTranslations("Selo");
  const locale = await getLocale();
  const session = await exigirOrgao();

  const { pagePendentes, pageHistorico } = await searchParams;
  const paginaPendentes = lerPaginaAtual(pagePendentes);
  const paginaHistorico = lerPaginaAtual(pageHistorico);

  const orgao = await prisma.orgao.findUnique({
    where: { id: session.user.orgaoId! },
    include: { categorias: { select: { id: true, nome: true } } },
  });

  // categoriasIds null = orgao sem categoria atribuida, atende qualquer
  // uma da cidade (ver orgaoAtendeCategoria em lib/orgaos/orgaoCategoria.ts).
  const categoriaIds =
    orgao && orgao.categorias.length > 0 ? orgao.categorias.map((c) => c.id) : null;

  const filtroPendentes = orgao
    ? {
        cidadeId: orgao.cidadeId,
        status: {
          in: [StatusReclamacao.PUBLICADA, StatusReclamacao.EM_ANDAMENTO],
        },
        ...(categoriaIds ? { categoriaId: { in: categoriaIds } } : {}),
      }
    : null;

  const [pendentes, totalPendentes, metricas, historico, totalHistorico] = await Promise.all([
    filtroPendentes
      ? prisma.reclamacao.findMany({
          where: filtroPendentes,
          orderBy: { publicadaEm: "asc" },
          include: { categoria: true },
          skip: calcularSkip(paginaPendentes),
          take: ITENS_POR_PAGINA,
        })
      : Promise.resolve([]),
    filtroPendentes ? prisma.reclamacao.count({ where: filtroPendentes }) : Promise.resolve(0),
    orgao
      ? calcularMetricasOrgao(orgao.id)
      : Promise.resolve(null),
    orgao
      ? prisma.respostaOficial.findMany({
          where: { orgaoId: orgao.id },
          orderBy: { createdAt: "desc" },
          distinct: ["reclamacaoId"],
          skip: calcularSkip(paginaHistorico),
          take: ITENS_POR_PAGINA,
          include: {
            reclamacao: {
              select: {
                titulo: true,
                protocolo: true,
                status: true,
                avaliacao: { select: { nota: true, resolvido: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
    orgao
      ? prisma.respostaOficial
          .findMany({ where: { orgaoId: orgao.id }, distinct: ["reclamacaoId"], select: { id: true } })
          .then((linhas) => linhas.length)
      : Promise.resolve(0),
  ]);
  const totalPaginasPendentes = calcularTotalPaginas(totalPendentes);
  const totalPaginasHistorico = calcularTotalPaginas(totalHistorico);

  const classificacao = metricas
    ? classificarIndice(metricas.indiceResolucao, metricas.totalRespondidas)
    : null;

  return (
    <main className={`${containerPagina} max-w-3xl`}>
      <CabecalhoPagina
        titulo={`${t("titulo")}${orgao ? ` — ${orgao.nome}` : ""}`}
        descricao={
          orgao &&
          (categoriaIds
            ? t("atende", { categorias: orgao.categorias.map((c) => c.nome).join(", ") })
            : t("atendeTodas"))
        }
      />

      {orgao && metricas && classificacao && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className={`inline-block w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${classificacao.className}`}
              >
                {tSelo(classificacao.chave)}
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {t("suaReputacao")}
              </span>
            </div>
            <Link href={`/orgaos/${orgao.id}`} className="text-sm text-primary hover:underline">
              {t("verComoOsCidadaosVeem")}
            </Link>
          </div>

          <PainelNumeros
            itens={[
              {
                rotulo: t("resolvidas"),
                valor: metricas.indiceResolucao !== null ? `${metricas.indiceResolucao}%` : "—",
              },
              {
                rotulo: t("tempoMedioResposta"),
                valor:
                  metricas.tempoMedioRespostaDias !== null
                    ? `${metricas.tempoMedioRespostaDias}d`
                    : "—",
              },
              {
                rotulo: t("notaCidadaos"),
                valor: metricas.notaMedia !== null ? `${metricas.notaMedia}/5` : "—",
              },
              { rotulo: t("avaliacoesRecebidas"), valor: String(metricas.totalAvaliacoes) },
            ]}
          />
        </section>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {t("pendentesDeResposta")} {totalPendentes > 0 && `(${totalPendentes})`}
        </h2>

        {pendentes.length === 0 && (
          <EstadoVazio icone={CircleCheck} titulo={t("nenhumaPendente")} />
        )}

        {pendentes.map((reclamacao) => (
          <div key={reclamacao.id} className={`flex flex-col gap-2 ${cartao}`}>
            <p className="font-medium text-slate-900 dark:text-slate-100">{reclamacao.titulo}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              <span className="font-mono text-xs">{reclamacao.protocolo}</span> ·{" "}
              {reclamacao.categoria.nome} · {reclamacao.endereco}
            </p>
            <p className="text-slate-700 dark:text-slate-300">{reclamacao.descricao}</p>

            <form
              action={responderReclamacao.bind(null, reclamacao.id, reclamacao.protocolo)}
              className="flex flex-col gap-2"
            >
              <textarea
                name="texto"
                required
                minLength={10}
                placeholder={tResp("respostaOficial")}
                rows={3}
                className={campoInput}
              />
              <select name="novoStatus" defaultValue="" className={campoInput}>
                <option value="">{tResp("manterStatus")}</option>
                <option value="EM_ANDAMENTO">{tResp("marcarEmAndamento")}</option>
                <option value="RESOLVIDA">{tResp("marcarResolvida")}</option>
              </select>
              <input type="date" name="prazoEstimado" className={campoInput} />
              <button type="submit" className={`${botaoPrimario} w-fit`}>
                {tResp("enviarResposta")}
              </button>
            </form>
          </div>
        ))}

        <Paginacao
          paginaAtual={paginaPendentes}
          totalPaginas={totalPaginasPendentes}
          basePath="/orgao"
          paramName="pagePendentes"
          searchParams={{
            pageHistorico: typeof pageHistorico === "string" ? pageHistorico : undefined,
          }}
        />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {t("historicoRespostas")} {totalHistorico > 0 && `(${totalHistorico})`}
        </h2>

        {historico.length === 0 && (
          <EstadoVazio icone={MessageSquareText} titulo={t("nenhumaRespondida")} />
        )}

        {historico.map((resposta) => (
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-400 dark:text-slate-500">
                <span className="font-mono">{resposta.reclamacao.protocolo}</span> ·{" "}
                {resposta.createdAt.toLocaleDateString(locale)}
              </p>
              {resposta.reclamacao.avaliacao ? (
                <p
                  className={`text-xs font-medium ${
                    resposta.reclamacao.avaliacao.resolvido
                      ? "text-green-700 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {resposta.reclamacao.avaliacao.resolvido
                    ? `✓ ${t("cidadaoConfirmou")}`
                    : `✗ ${t("cidadaoDizNaoResolvido")}`}{" "}
                  ({resposta.reclamacao.avaliacao.nota}/5)
                </p>
              ) : (
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {t("aguardandoAvaliacao")}
                </p>
              )}
            </div>
          </Link>
        ))}

        <Paginacao
          paginaAtual={paginaHistorico}
          totalPaginas={totalPaginasHistorico}
          basePath="/orgao"
          paramName="pageHistorico"
          searchParams={{
            pagePendentes: typeof pagePendentes === "string" ? pagePendentes : undefined,
          }}
        />
      </div>
    </main>
  );
}
