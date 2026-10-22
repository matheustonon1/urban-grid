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
} from "@/lib/estilos";
import { metadataDaPagina } from "@/lib/metadata";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { BotaoAcao, FormularioAcao } from "@/components/ui/formulario-acao";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { FormularioRejeicao } from "@/components/ui/formulario-rejeicao";
import { ResumoLateral } from "@/components/ui/resumo-lateral";
import { Secao } from "@/components/ui/secao";
import { Selo } from "@/components/ui/selo";
import { formatarDataHora } from "@/lib/util/formatarData";

import { aprovarSolicitacao, rejeitarSolicitacao } from "./actions";
import { exigirAdmin } from "./exigir-admin";

export const generateMetadata = metadataDaPagina("SolicitacoesOrgao");

export default async function SolicitacoesOrgaoPage({
  searchParams,
}: PageProps<"/solicitacoes-orgao">) {
  const t = await getTranslations("SolicitacoesOrgao");
  const tNav = await getTranslations("AdminNav");
  const locale = await getLocale();
  await exigirAdmin();

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

            {pendentes.map((solicitacao) => (
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
                      detalhes: [t("confirmarAprovarDetalheEmail"), t("confirmarAprovarDetalheResposta")],
                      confirmar: t("confirmarAprovarBotao"),
                      tom: "primario",
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
            ))}

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
