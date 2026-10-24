import { getLocale, getTranslations } from "next-intl/server";
import { CircleCheck } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { Campo } from "@/components/formulario/campo";
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
import { metadataDaPagina } from "@/lib/metadata";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { BotaoAcao, FormularioAcao } from "@/components/ui/formulario-acao";
import { FormularioRejeicao } from "@/components/ui/formulario-rejeicao";
import { ResumoLateral } from "@/components/ui/resumo-lateral";
import { Secao } from "@/components/ui/secao";
import { Selo } from "@/components/ui/selo";
import { formatarDataHora } from "@/lib/util/formatarData";
import { EstadoVazio } from "@/components/ui/estado-vazio";

import { aprovarSolicitacaoCidade, rejeitarSolicitacaoCidade } from "./actions";
import { exigirAdmin } from "../solicitacoes-orgao/exigir-admin";

export const generateMetadata = metadataDaPagina("SolicitacoesCidade");

export default async function SolicitacoesCidadePage({
  searchParams,
}: PageProps<"/solicitacoes-cidade">) {
  const t = await getTranslations("SolicitacoesCidade");
  const tNav = await getTranslations("AdminNav");
  const locale = await getLocale();
  await exigirAdmin();

  const { pagePendentes, pageDecididas } = await searchParams;
  const paginaPendentes = lerPaginaAtual(pagePendentes);
  const paginaDecididas = lerPaginaAtual(pageDecididas);
  const filtroDecididas = { status: { not: "PENDENTE" as const } };

  const [pendentes, totalPendentes, decididasRecentemente, totalDecididas] = await Promise.all([
    prisma.solicitacaoCidade.findMany({
      where: { status: "PENDENTE" },
      orderBy: { createdAt: "asc" },
      skip: calcularSkip(paginaPendentes),
      take: ITENS_POR_PAGINA,
    }),
    prisma.solicitacaoCidade.count({ where: { status: "PENDENTE" } }),
    prisma.solicitacaoCidade.findMany({
      where: filtroDecididas,
      orderBy: { analisadoEm: "desc" },
      skip: calcularSkip(paginaDecididas),
      take: ITENS_POR_PAGINA,
      include: { analisadoPor: true },
    }),
    prisma.solicitacaoCidade.count({ where: filtroDecididas }),
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
                <h3 className="text-xl leading-snug font-extrabold tracking-tight text-ink">
                  {solicitacao.nomeCidade} - {solicitacao.uf}
                </h3>
                <p className="text-sm text-ink-2">
                  {t("solicitadoPor")} {solicitacao.nomeSolicitante} · {solicitacao.email}
                </p>
                <p className="text-xs text-ink-muted">
                  {t("enviadoEm")} {formatarDataHora(solicitacao.createdAt, locale)}
                </p>

                <div className="mt-2 flex flex-col gap-5 border-t border-line pt-5">
                  <FormularioAcao
                    action={aprovarSolicitacaoCidade.bind(null, solicitacao.id)}
                    className="flex flex-col gap-3 sm:flex-row sm:items-end"
                    confirmacao={{
                      titulo: t("confirmarAprovarTitulo", { cidade: solicitacao.nomeCidade }),
                      // {codigoIbge} é o campo do formulário: o diálogo mostra o que foi digitado.
                      descricao: t("confirmarAprovarDescricao", {
                        cidade: solicitacao.nomeCidade,
                        uf: solicitacao.uf,
                        codigoIbge: "{codigoIbge}",
                      }),
                      detalhes: [t("confirmarAprovarDetalhe")],
                      confirmar: t("confirmarAprovarBotao"),
                      tom: "primario",
                    }}
                  >
                    <div className="sm:w-64">
                      <Campo id={`ibge-${solicitacao.id}`} rotulo={t("codigoIbgePlaceholder")}>
                        <input
                          id={`ibge-${solicitacao.id}`}
                          type="text"
                          name="codigoIbge"
                          required
                          pattern="\d{7}"
                          inputMode="numeric"
                          title={t("codigoIbgeAjuda")}
                          className={campoInput}
                        />
                      </Campo>
                    </div>
                    <BotaoAcao className={botaoPrimario}>{t("aprovar")}</BotaoAcao>
                  </FormularioAcao>

                  <FormularioRejeicao
                    id={`motivo-${solicitacao.id}`}
                    action={rejeitarSolicitacaoCidade.bind(null, solicitacao.id)}
                    rotulo={t("motivoRejeicaoPlaceholder")}
                    botao={t("rejeitar")}
                    confirmacao={{
                      titulo: t("confirmarRejeitarTitulo", { cidade: solicitacao.nomeCidade }),
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
              basePath="/solicitacoes-cidade"
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
                        {solicitacao.nomeCidade} - {solicitacao.uf}
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
                basePath="/solicitacoes-cidade"
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
          />
        </aside>
      </div>
    </main>
  );
}
