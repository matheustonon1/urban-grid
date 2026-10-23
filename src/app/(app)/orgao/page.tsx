import Link from "next/link";
import { StatusReclamacao } from "@prisma/client";
import { getLocale, getTranslations } from "next-intl/server";
import { CircleCheck, MessageSquareText } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/reclamacao/status-badge";
import { Etiqueta, type TomEtiqueta } from "@/components/ui/etiqueta";
import { Paginacao } from "@/components/ui/paginacao";
import { calcularSkip, calcularTotalPaginas, ITENS_POR_PAGINA, lerPaginaAtual } from "@/lib/util/paginacao";
import {
  botaoPrimario,
  campoInput,
  cartaoSecao,
  colunaLateral,
  colunaPrincipal,
  grade,
  pagina,
} from "@/lib/estilos";
import { calcularMetricasOrgao, classificarIndice } from "@/lib/orgaos/reputacaoOrgao";
import { metadataDaPagina } from "@/lib/metadata";
import { formatarData } from "@/lib/util/formatarData";
import { formatarTempoRelativo } from "@/lib/util/tempo-relativo";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Secao } from "@/components/ui/secao";
import { Campo } from "@/components/formulario/campo";
import { BotaoAcao, FormularioAcao } from "@/components/ui/formulario-acao";

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
          include: {
            categoria: true,
            _count: { select: { confirmacoes: true } },
            // A última resposta oficial (de qualquer órgão): quando foi e que prazo deu.
            respostas: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { createdAt: true, prazoEstimado: true },
            },
          },
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

  const agora = new Date();
  const DIA_MS = 86_400_000;
  // Quanto uma reclamação SEM resposta já esperou: neutro na primeira semana, âmbar
  // até a segunda, vermelho depois - o órgão vê de relance o que está vencendo.
  const tomDaEspera = (desde: Date): TomEtiqueta => {
    const dias = (agora.getTime() - desde.getTime()) / DIA_MS;
    return dias >= 15 ? "erro" : dias >= 7 ? "atencao" : "neutro";
  };

  return (
    <main className={pagina}>
      <CabecalhoPagina
        kicker={t("kicker")}
        titulo={orgao ? orgao.nome : t("titulo")}
        descricao={
          orgao &&
          (categoriaIds
            ? t("atende", { categorias: orgao.categorias.map((c) => c.nome).join(", ") })
            : t("atendeTodas"))
        }
      />

      <div className={grade}>
        <div className={colunaPrincipal}>
          <Secao id="pendentes" titulo={t("pendentesDeResposta")} contador={totalPendentes}>
            {pendentes.length === 0 && (
              <EstadoVazio icone={CircleCheck} titulo={t("nenhumaPendente")} />
            )}

            {pendentes.map((reclamacao) => {
              const publicadaEm = reclamacao.publicadaEm ?? reclamacao.createdAt;
              const ultimaResposta = reclamacao.respostas[0];
              const prazo = ultimaResposta?.prazoEstimado;

              return (
                <article key={reclamacao.id} className={`flex flex-col gap-4 ${cartaoSecao}`}>
                  <header className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={reclamacao.status} />
                      {ultimaResposta ? (
                        <Etiqueta tom="apagado">
                          {t("ultimaResposta", {
                            tempo: formatarTempoRelativo(ultimaResposta.createdAt, locale),
                          })}
                        </Etiqueta>
                      ) : (
                        <Etiqueta tom={tomDaEspera(publicadaEm)}>
                          {t("semResposta", { tempo: formatarTempoRelativo(publicadaEm, locale) })}
                        </Etiqueta>
                      )}
                      {prazo && (
                        <Etiqueta tom={prazo < agora ? "erro" : "neutro"}>
                          {prazo < agora
                            ? t("prazoVencido", { data: formatarData(prazo, locale) })
                            : t("prazo", { data: formatarData(prazo, locale) })}
                        </Etiqueta>
                      )}
                    </div>
                    <p className="kicker">
                      {reclamacao.protocolo} · {reclamacao.categoria.nome}
                    </p>
                    <h3 className="text-lg leading-snug font-extrabold tracking-tight text-ink">
                      <Link href={`/reclamacoes/${reclamacao.protocolo}`} className="hover:text-brand">
                        {reclamacao.titulo}
                      </Link>
                    </h3>
                    <p className="text-sm text-ink-muted">
                      {reclamacao.endereco} · {t("confirmacoes", { count: reclamacao._count.confirmacoes })}
                    </p>
                  </header>
                  <p className="line-clamp-3 leading-relaxed text-ink-2">{reclamacao.descricao}</p>

                  {/* O formulário fica recolhido: sete reclamações com sete formulários abertos
                      faziam do painel uma página de rolagem sem fim. */}
                  <details className="group border-t border-line pt-4">
                    <summary className={`${botaoPrimario} w-fit cursor-pointer list-none`}>
                      {t("responder")}
                    </summary>
                    <FormularioAcao
                      action={responderReclamacao.bind(null, reclamacao.id, reclamacao.protocolo)}
                      limparAoSucesso
                      recolherAoSucesso
                      className="animate-fade-in mt-4 flex flex-col gap-4"
                    >
                      <Campo id={`resposta-${reclamacao.id}`} rotulo={tResp("respostaOficial")}>
                        <textarea
                          id={`resposta-${reclamacao.id}`}
                          name="texto"
                          required
                          minLength={10}
                          rows={3}
                          className={campoInput}
                        />
                      </Campo>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Campo id={`status-${reclamacao.id}`} rotulo={tResp("statusRotulo")}>
                          <select
                            id={`status-${reclamacao.id}`}
                            name="novoStatus"
                            defaultValue=""
                            className={campoInput}
                          >
                            <option value="">{tResp("manterStatus")}</option>
                            <option value="EM_ANDAMENTO">{tResp("marcarEmAndamento")}</option>
                            <option value="RESOLVIDA">{tResp("marcarResolvida")}</option>
                          </select>
                        </Campo>
                        <Campo
                          id={`prazo-${reclamacao.id}`}
                          rotulo={tResp("prazoRotulo")}
                          opcional={tResp("opcional")}
                        >
                          <input
                            id={`prazo-${reclamacao.id}`}
                            type="date"
                            name="prazoEstimado"
                            className={campoInput}
                          />
                        </Campo>
                      </div>
                      <BotaoAcao className={`${botaoPrimario} w-fit`}>{tResp("enviarResposta")}</BotaoAcao>
                    </FormularioAcao>
                  </details>
                </article>
              );
            })}

            <Paginacao
              paginaAtual={paginaPendentes}
              totalPaginas={totalPaginasPendentes}
              basePath="/orgao"
              paramName="pagePendentes"
              searchParams={{
                pageHistorico: typeof pageHistorico === "string" ? pageHistorico : undefined,
              }}
            />
          </Secao>

          <Secao id="historico" titulo={t("historicoRespostas")} contador={totalHistorico}>
            {historico.length === 0 && (
              <EstadoVazio icone={MessageSquareText} titulo={t("nenhumaRespondida")} />
            )}

            {historico.length > 0 && (
              <ul className="-mt-2 divide-y divide-line">
                {historico.map((resposta) => (
                  <li key={resposta.id}>
                    <Link
                      href={`/reclamacoes/${resposta.reclamacao.protocolo}`}
                      className="group flex flex-col gap-2 py-5 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <p className="font-bold text-ink group-hover:text-brand">
                          {resposta.reclamacao.titulo}
                        </p>
                        <StatusBadge status={resposta.reclamacao.status} />
                      </div>
                      <p className="line-clamp-3 leading-relaxed text-ink-2">{resposta.texto}</p>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="kicker">
                          {resposta.reclamacao.protocolo} ·{" "}
                          {resposta.createdAt.toLocaleDateString(locale)}
                        </p>
                        {resposta.reclamacao.avaliacao ? (
                          <p
                            className={`text-xs font-semibold ${
                              resposta.reclamacao.avaliacao.resolvido
                                ? "text-ok-ink"
                                : "text-danger-ink"
                            }`}
                          >
                            {resposta.reclamacao.avaliacao.resolvido
                              ? `✓ ${t("cidadaoConfirmou")}`
                              : `✗ ${t("cidadaoDizNaoResolvido")}`}{" "}
                            ({resposta.reclamacao.avaliacao.nota}/5)
                          </p>
                        ) : (
                          <p className="text-xs text-ink-muted">{t("aguardandoAvaliacao")}</p>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <Paginacao
              paginaAtual={paginaHistorico}
              totalPaginas={totalPaginasHistorico}
              basePath="/orgao"
              paramName="pageHistorico"
              searchParams={{
                pagePendentes: typeof pagePendentes === "string" ? pagePendentes : undefined,
              }}
            />
          </Secao>
        </div>

        <aside className={colunaLateral}>
          {orgao && metricas && classificacao && (
            <section className={`flex flex-col gap-5 ${cartaoSecao}`}>
              <div className="flex flex-col gap-2">
                <span className="kicker">{t("suaReputacao")}</span>
                <span
                  className={`inline-block w-fit rounded-[5px] px-2.5 py-1 text-sm font-semibold ${classificacao.className}`}
                >
                  {tSelo(classificacao.chave)}
                </span>
              </div>

              <dl className="flex flex-col divide-y divide-line">
                {[
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
                ].map((item) => (
                  <div key={item.rotulo} className="flex items-baseline justify-between gap-4 py-3">
                    <dt className="text-sm text-ink-muted">{item.rotulo}</dt>
                    <dd className="font-mono text-xl font-medium text-ink tabular-nums">{item.valor}</dd>
                  </div>
                ))}
              </dl>

              <Link
                href={`/orgaos/${orgao.id}`}
                className="text-sm font-semibold text-brand underline underline-offset-2"
              >
                {t("verComoOsCidadaosVeem")}
              </Link>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
