import { getTranslations } from "next-intl/server";
import { Building2, ChevronRight } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { Campo } from "@/components/formulario/campo";
import { Paginacao } from "@/components/ui/paginacao";
import { ResumoLateral } from "@/components/ui/resumo-lateral";
import { Secao } from "@/components/ui/secao";
import { calcularSkip, calcularTotalPaginas, ITENS_POR_PAGINA, lerPaginaAtual } from "@/lib/util/paginacao";
import {
  botaoPerigo,
  botaoPrimario,
  botaoSecundario,
  campoInput,
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
import { Selo } from "@/components/ui/selo";

import { exigirAdmin } from "../solicitacoes-orgao/exigir-admin";
import {
  alternarAtivoOrgao,
  atualizarCategoriasOrgao,
  atualizarDadosOrgao,
} from "./actions";
import { ReenviarConvite } from "./reenviar-convite";

export const generateMetadata = metadataDaPagina("OrgaosCategorias");

export default async function OrgaosCategoriasPage({
  searchParams,
}: PageProps<"/orgaos-categorias">) {
  const t = await getTranslations("OrgaosCategorias");
  const tNav = await getTranslations("AdminNav");
  await exigirAdmin();

  const { page } = await searchParams;
  const paginaAtual = lerPaginaAtual(page);

  // Sem filtro por ativo aqui de propósito - esta é a única tela admin
  // que lista órgãos, então também precisa ser onde um órgão inativo
  // aparece pra poder ser reativado (ver alternarAtivoOrgao em ./actions).
  const [orgaos, totalOrgaos, categorias, totalAtivos, totalConvites] = await Promise.all([
    prisma.orgao.findMany({
      orderBy: [{ ativo: "desc" }, { nome: "asc" }],
      include: {
        cidade: true,
        categorias: { select: { id: true } },
        // senhaHash nulo = convite ainda não aceito (ver reenviarConviteOrgao
        // em ./actions) - precisa saber quem está nesse estado pra mostrar o
        // botão de reenviar só onde faz sentido.
        responsaveis: {
          where: { papel: "ORGAO", senhaHash: null },
          select: { id: true, email: true },
        },
      },
      skip: calcularSkip(paginaAtual),
      take: ITENS_POR_PAGINA,
    }),
    prisma.orgao.count(),
    prisma.categoria.findMany({ where: { ativa: true }, orderBy: { ordem: "asc" } }),
    prisma.orgao.count({ where: { ativo: true } }),
    prisma.user.count({ where: { papel: "ORGAO", senhaHash: null } }),
  ]);
  const totalPaginas = calcularTotalPaginas(totalOrgaos);

  return (
    <main className={pagina}>
      <CabecalhoPagina
        kicker={tNav("kickerAdmin")}
        titulo={t("titulo")}
        descricao={t("descricao")}
      />

      <div className={grade}>
        <div className={colunaPrincipal}>
          <Secao id="orgaos" titulo={t("secaoOrgaos")} contador={totalOrgaos}>
            {orgaos.length === 0 && <EstadoVazio icone={Building2} titulo={t("nenhumOrgao")} />}

            {orgaos.map((orgao) => (
              <article
                key={orgao.id}
                className={`flex flex-col gap-4 ${cartaoSecao} ${!orgao.ativo ? "border-dashed" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <h3 className="flex flex-wrap items-center gap-2 text-xl leading-snug font-extrabold tracking-tight text-ink">
                      {orgao.nome}
                      {orgao.sigla && ` (${orgao.sigla})`}
                      {!orgao.ativo && <Selo tom="neutro">{t("inativo")}</Selo>}
                      {orgao.responsaveis.length > 0 && (
                        <Selo tom="atencao">{t("convitePendente")}</Selo>
                      )}
                    </h3>
                    <p className="text-sm text-ink-muted">
                      {orgao.cidade.nome}
                      {orgao.email && ` · ${orgao.email}`}
                    </p>
                    {orgao.responsaveis.map((responsavel) => (
                      <ReenviarConvite
                        key={responsavel.id}
                        userId={responsavel.id}
                        email={responsavel.email}
                        mostrarDica={process.env.NODE_ENV !== "production"}
                      />
                    ))}
                  </div>

                  <FormularioAcao
                    action={alternarAtivoOrgao.bind(null, orgao.id, !orgao.ativo)}
                    // Só desativar pede confirmação: reativar devolve o que se tirou.
                    confirmacao={
                      orgao.ativo
                        ? {
                            titulo: t("confirmarDesativarTitulo", { nome: orgao.nome }),
                            descricao: t("confirmarDesativarDescricao"),
                            detalhes: [t("confirmarDesativarDetalhe")],
                            confirmar: t("confirmarDesativarBotao"),
                            tom: "perigo",
                          }
                        : undefined
                    }
                  >
                    <BotaoAcao className={orgao.ativo ? botaoPerigo : botaoSecundario}>
                      {orgao.ativo ? t("desativar") : t("reativar")}
                    </BotaoAcao>
                  </FormularioAcao>
                </div>

                <div className="flex flex-col gap-3 border-t border-line pt-4">
                  <details className="group text-sm">
                    <summary className="flex w-fit cursor-pointer list-none items-center gap-2 font-semibold text-brand">
                      <ChevronRight
                        className="h-4 w-4 transition-transform group-open:rotate-90"
                        aria-hidden
                      />
                      {t("editarDados")}
                    </summary>
                    <FormularioAcao
                      action={atualizarDadosOrgao.bind(null, orgao.id)}
                      className="animate-fade-in mt-4 flex flex-col gap-4"
                    >
                      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
                        <Campo id={`nome-${orgao.id}`} rotulo={t("nome")}>
                          <input
                            id={`nome-${orgao.id}`}
                            type="text"
                            name="nome"
                            required
                            defaultValue={orgao.nome}
                            className={campoInput}
                          />
                        </Campo>
                        <Campo id={`sigla-${orgao.id}`} rotulo={t("sigla")}>
                          <input
                            id={`sigla-${orgao.id}`}
                            type="text"
                            name="sigla"
                            defaultValue={orgao.sigla ?? ""}
                            className={campoInput}
                          />
                        </Campo>
                      </div>
                      <Campo id={`email-${orgao.id}`} rotulo={t("email")}>
                        <input
                          id={`email-${orgao.id}`}
                          type="email"
                          name="email"
                          defaultValue={orgao.email ?? ""}
                          className={campoInput}
                        />
                      </Campo>
                      <BotaoAcao className={`${botaoSecundario} w-fit`}>{t("salvarDados")}</BotaoAcao>
                    </FormularioAcao>
                  </details>

                  <details className="group text-sm">
                    <summary className="flex w-fit cursor-pointer list-none items-center gap-2 font-semibold text-brand">
                      <ChevronRight
                        className="h-4 w-4 transition-transform group-open:rotate-90"
                        aria-hidden
                      />
                      {orgao.categorias.length === 0
                        ? t("atendeTodasResumo")
                        : t("atendeResumo", {
                            count: orgao.categorias.length,
                            total: categorias.length,
                          })}
                    </summary>
                    <FormularioAcao
                      action={atualizarCategoriasOrgao.bind(null, orgao.id)}
                      className="animate-fade-in mt-4 flex flex-col gap-4"
                    >
                      <div className="grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2">
                        {categorias.map((categoria) => (
                          <label
                            key={categoria.id}
                            className="flex items-center gap-2.5 text-sm text-ink-2"
                          >
                            <input
                              type="checkbox"
                              name="categoriaIds"
                              value={categoria.id}
                              defaultChecked={orgao.categorias.some((c) => c.id === categoria.id)}
                              className="h-4 w-4 shrink-0 accent-brand"
                            />
                            {categoria.nome}
                          </label>
                        ))}
                      </div>

                      <BotaoAcao className={`${botaoPrimario} w-fit`}>{t("salvar")}</BotaoAcao>
                    </FormularioAcao>
                  </details>
                </div>
              </article>
            ))}

            <Paginacao
              paginaAtual={paginaAtual}
              totalPaginas={totalPaginas}
              basePath="/orgaos-categorias"
            />
          </Secao>
        </div>

        <aside className={colunaLateral}>
          <ResumoLateral
            rotulo={t("secaoOrgaos")}
            valor={totalOrgaos}
            itens={[
              { rotulo: t("resumoAtivos"), valor: totalAtivos },
              { rotulo: t("resumoInativos"), valor: totalOrgaos - totalAtivos },
              { rotulo: t("resumoConvites"), valor: totalConvites },
            ]}
          />
        </aside>
      </div>
    </main>
  );
}
