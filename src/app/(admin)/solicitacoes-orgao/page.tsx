import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { CircleCheck } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { Paginacao } from "@/components/ui/paginacao";
import { calcularSkip, calcularTotalPaginas, ITENS_POR_PAGINA, lerPaginaAtual } from "@/lib/util/paginacao";
import {
  botaoPrimario,
  cartaoSecao,
  colunaLateral,
  colunaPrincipal,
  grade,
  pagina,
  rotuloSecao,
} from "@/lib/estilos";
import { metadataDaPagina } from "@/lib/metadata";
import { sinaisDaSolicitacao } from "@/lib/orgaos/sinaisSolicitacao";
import { Aviso } from "@/components/ui/aviso";
import { Etiqueta } from "@/components/ui/etiqueta";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { BotaoAcao, FormularioAcao } from "@/components/ui/formulario-acao";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { FormularioRejeicao } from "@/components/ui/formulario-rejeicao";
import { ResumoLateral } from "@/components/ui/resumo-lateral";
import { Secao } from "@/components/ui/secao";
import { Selo } from "@/components/ui/selo";
import { formatarDataHora } from "@/lib/util/formatarData";
import { usuarioTemDoisFatores } from "@/lib/seguranca/doisFatores";

import { aprovarSolicitacao, rejeitarSolicitacao } from "./actions";
import { exigirAdmin } from "./exigir-admin";

export const generateMetadata = metadataDaPagina("SolicitacoesOrgao");

export default async function SolicitacoesOrgaoPage({
  searchParams,
}: PageProps<"/solicitacoes-orgao">) {
  const t = await getTranslations("SolicitacoesOrgao");
  const tNav = await getTranslations("AdminNav");
  const locale = await getLocale();
  const session = await exigirAdmin();
  // Aprovar concede voz oficial: o diálogo pede senha e código de duas etapas.
  const temDoisFatores = await usuarioTemDoisFatores(session.user.id);

  const { pagePendentes, pageDecididas } = await searchParams;
  const paginaPendentes = lerPaginaAtual(pagePendentes);
  const paginaDecididas = lerPaginaAtual(pageDecididas);
  const filtroDecididas = { status: { not: "PENDENTE" as const } };

  const [pendentes, totalPendentes, decididasRecentemente, totalDecididas] = await Promise.all([
    prisma.solicitacaoOrgao.findMany({
      where: { status: "PENDENTE" },
      orderBy: { createdAt: "asc" },
      include: { cidade: { include: { estado: true } } },
      skip: calcularSkip(paginaPendentes),
      take: ITENS_POR_PAGINA,
    }),
    prisma.solicitacaoOrgao.count({ where: { status: "PENDENTE" } }),
    prisma.solicitacaoOrgao.findMany({
      where: filtroDecididas,
      orderBy: { analisadoEm: "desc" },
      skip: calcularSkip(paginaDecididas),
      take: ITENS_POR_PAGINA,
      include: { cidade: true, analisadoPor: true },
    }),
    prisma.solicitacaoOrgao.count({ where: filtroDecididas }),
  ]);
  const totalPaginasPendentes = calcularTotalPaginas(totalPendentes);
  const totalPaginasDecididas = calcularTotalPaginas(totalDecididas);

  // O que o admin não via ao decidir: se já existe um órgão com esse nome na cidade (aprovar
  // adiciona a conta nova a ELE, por causa do upsert em aprovarSolicitacao - a mesma chave
  // única, então a mesma regra de maiúsculas/acentos do banco) e se aquele e-mail já teve um
  // pedido rejeitado.
  const [orgaosExistentes, rejeicoesPorEmail] = await Promise.all([
    Promise.all(
      pendentes.map((solicitacao) =>
        prisma.orgao.findUnique({
          where: {
            cidadeId_nome: { cidadeId: solicitacao.cidadeId, nome: solicitacao.nomeOrgao },
          },
          select: { _count: { select: { responsaveis: true } } },
        })
      )
    ),
    pendentes.length > 0
      ? prisma.solicitacaoOrgao.groupBy({
          by: ["email"],
          where: { email: { in: pendentes.map((s) => s.email) }, status: "REJEITADA" },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);
  const rejeicoes = new Map(rejeicoesPorEmail.map((linha) => [linha.email, linha._count._all]));

  return (
    <main className={pagina}>
      <CabecalhoPagina
        kicker={tNav("kickerAdmin")}
        titulo={t("titulo")}
        descricao={t("resumoPendentes", { count: totalPendentes })}
      />

      <div className={grade}>
        <div className={colunaPrincipal}>
          <Secao id="pendentes" titulo={t("secaoPendentes")}>
            {pendentes.length === 0 && (
              <EstadoVazio icone={CircleCheck} titulo={t("nenhumaPendente")} />
            )}

            {pendentes.map((solicitacao, indice) => {
              const responsaveisExistentes = orgaosExistentes[indice]?._count.responsaveis ?? null;
              const sinais = sinaisDaSolicitacao({
                email: solicitacao.email,
                responsaveisDoOrgaoExistente: responsaveisExistentes,
                rejeicoesAnteriores: rejeicoes.get(solicitacao.email) ?? 0,
              });

              return (
              <article key={solicitacao.id} className={`flex flex-col gap-3 ${cartaoSecao}`}>
                <p className="kicker">
                  {solicitacao.cidade.nome} - {solicitacao.cidade.estado.uf}
                </p>
                <h3 className="text-xl leading-snug font-extrabold tracking-tight text-ink">
                  {solicitacao.nomeOrgao}
                  {solicitacao.sigla && ` (${solicitacao.sigla})`}
                </h3>
                <p className="text-sm text-ink-2">
                  {t("responsavel")} {solicitacao.nomeResponsavel} · {solicitacao.email}
                  {solicitacao.telefone && ` · ${solicitacao.telefone}`}
                </p>
                <p className="text-xs text-ink-muted">
                  {t("enviadoEm")} {formatarDataHora(solicitacao.createdAt, locale)}
                </p>

                <div className="flex flex-col gap-2.5 border-t border-line pt-4">
                  <p className={rotuloSecao}>{t("sinaisRotulo")}</p>
                  <div className="flex flex-wrap gap-2">
                    {sinais.map((sinal) => (
                      <Etiqueta key={sinal.chave} tom={sinal.tom}>
                        {t(`sinais.${sinal.chave}`, {
                          count: "count" in sinal ? sinal.count : 0,
                        })}
                      </Etiqueta>
                    ))}
                  </div>
                  {responsaveisExistentes !== null && (
                    <Aviso tom="atencao">
                      {t("avisoOrgaoJaExiste", { responsavel: solicitacao.nomeResponsavel })}
                    </Aviso>
                  )}
                  <p className="text-xs text-ink-muted">{t("sinaisAviso")}</p>
                </div>

                <div className="mt-2 grid gap-4 border-t border-line pt-5 sm:grid-cols-[auto_1fr] sm:items-end">
                  <FormularioAcao
                    action={aprovarSolicitacao.bind(null, solicitacao.id)}
                    confirmacao={{
                      titulo: t("confirmarAprovarTitulo", { orgao: solicitacao.nomeOrgao }),
                      descricao: t("confirmarAprovarDescricao", {
                        responsavel: solicitacao.nomeResponsavel,
                        email: solicitacao.email,
                        cidade: solicitacao.cidade.nome,
                      }),
                      detalhes: [
                        t("confirmarAprovarDetalheEmail"),
                        t("confirmarAprovarDetalheResposta"),
                        ...(responsaveisExistentes !== null
                          ? [t("confirmarAprovarDetalheOrgaoExistente", { count: responsaveisExistentes })]
                          : []),
                      ],
                      confirmar: t("confirmarAprovarBotao"),
                      tom: "primario",
                      senha: true,
                      segundoFator: temDoisFatores ? "ativo" : "ausente",
                    }}
                  >
                    <BotaoAcao className={`${botaoPrimario} w-full sm:w-auto`}>{t("aprovar")}</BotaoAcao>
                  </FormularioAcao>

                  <FormularioRejeicao
                    id={`motivo-${solicitacao.id}`}
                    action={rejeitarSolicitacao.bind(null, solicitacao.id)}
                    rotulo={t("motivoRejeicaoPlaceholder")}
                    botao={t("rejeitar")}
                    confirmacao={{
                      titulo: t("confirmarRejeitarTitulo", { orgao: solicitacao.nomeOrgao }),
                      descricao: t("confirmarRejeitarDescricao", { email: solicitacao.email }),
                      confirmar: t("confirmarRejeitarBotao"),
                      tom: "perigo",
                    }}
                  />
                </div>
              </article>
              );
            })}

            <Paginacao
              paginaAtual={paginaPendentes}
              totalPaginas={totalPaginasPendentes}
              basePath="/solicitacoes-orgao"
              paramName="pagePendentes"
              searchParams={{
                pageDecididas: typeof pageDecididas === "string" ? pageDecididas : undefined,
              }}
            />
          </Secao>

          {decididasRecentemente.length > 0 && (
            <Secao id="decididas" titulo={t("decididasRecentemente")} contador={totalDecididas}>
              <ul className="-mt-2 divide-y divide-line">
                {decididasRecentemente.map((solicitacao) => (
                  <li key={solicitacao.id} className="flex flex-col gap-1.5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-bold text-ink">
                        {solicitacao.nomeOrgao}
                        {solicitacao.sigla && ` (${solicitacao.sigla})`} · {solicitacao.cidade.nome}
                      </p>
                      <Selo tom={solicitacao.status === "APROVADA" ? "sucesso" : "erro"}>
                        {solicitacao.status === "APROVADA" ? t("aprovada") : t("rejeitada")}
                      </Selo>
                    </div>
                    <p className="text-xs text-ink-muted">
                      {solicitacao.email} · {t("por")}{" "}
                      {solicitacao.analisadoPor?.name ?? solicitacao.analisadoPor?.email ?? "—"}{" "}
                      {t("em")}{" "}
                      {solicitacao.analisadoEm
                        ? formatarDataHora(solicitacao.analisadoEm, locale)
                        : "—"}
                    </p>
                    {solicitacao.motivoRejeicao && (
                      <p className="text-sm text-ink-2 italic">“{solicitacao.motivoRejeicao}”</p>
                    )}
                  </li>
                ))}
              </ul>

              <Paginacao
                paginaAtual={paginaDecididas}
                totalPaginas={totalPaginasDecididas}
                basePath="/solicitacoes-orgao"
                paramName="pageDecididas"
                searchParams={{
                  pagePendentes: typeof pagePendentes === "string" ? pagePendentes : undefined,
                }}
              />
            </Secao>
          )}
        </div>

        <aside className={colunaLateral}>
          <ResumoLateral
            rotulo={t("resumoRotulo")}
            valor={totalPendentes}
            itens={[{ rotulo: t("resumoDecididas"), valor: totalDecididas }]}
          >
            <Link
              href="/cadastro?tipo=orgao"
              className="w-fit text-sm font-semibold text-brand underline underline-offset-2"
            >
              {t("verFormularioPublico")}
            </Link>
          </ResumoLateral>
        </aside>
      </div>
    </main>
  );
}
