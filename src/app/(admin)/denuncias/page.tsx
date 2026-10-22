import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { AvatarIniciais } from "@/components/ui/avatar-iniciais";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { BotaoAcao, FormularioAcao } from "@/components/ui/formulario-acao";
import { Etiqueta } from "@/components/ui/etiqueta";
import { Paginacao } from "@/components/ui/paginacao";
import { ResumoLateral } from "@/components/ui/resumo-lateral";
import { Secao } from "@/components/ui/secao";
import { TempoNaFila } from "@/components/moderacao/tempo-na-fila";
import { calcularSkip, calcularTotalPaginas, ITENS_POR_PAGINA, lerPaginaAtual } from "@/lib/util/paginacao";
import {
  blocoCitacao,
  botaoPerigo,
  botaoPrimario,
  botaoSecundario,
  campoInput,
  cartaoSecao,
  colunaLateral,
  colunaPrincipal,
  grade,
  pagina,
  painelSuave,
} from "@/lib/estilos";
import { formatarDataHora } from "@/lib/util/formatarData";
import { metadataDaPagina } from "@/lib/metadata";

import { exigirModerador } from "../moderacao/exigir-moderador";
import { banirAutor, marcarImprocedente, marcarProcedente } from "./actions";

export const generateMetadata = metadataDaPagina("Denuncias");

export default async function DenunciasPage({ searchParams }: PageProps<"/denuncias">) {
  const t = await getTranslations("Denuncias");
  const tMotivo = await getTranslations("MotivoDenuncia");
  const tNav = await getTranslations("AdminNav");
  const locale = await getLocale();
  const session = await exigirModerador();
  const ehAdmin = session.user.papel === "ADMIN";

  const { page } = await searchParams;
  const paginaAtual = lerPaginaAtual(page);
  const filtro = { status: "ABERTA" as const };

  const [denuncias, totalDenuncias, porTipo] = await Promise.all([
    prisma.denuncia.findMany({
      where: filtro,
      orderBy: { createdAt: "asc" },
      include: { denunciante: true },
      skip: calcularSkip(paginaAtual),
      take: ITENS_POR_PAGINA,
    }),
    prisma.denuncia.count({ where: filtro }),
    prisma.denuncia.groupBy({ by: ["alvoTipo"], where: filtro, _count: { _all: true } }),
  ]);
  const totalPaginas = calcularTotalPaginas(totalDenuncias);
  const contagemPorTipo = new Map(porTipo.map((linha) => [linha.alvoTipo, linha._count._all]));

  const idsReclamacao = denuncias.filter((d) => d.alvoTipo === "RECLAMACAO").map((d) => d.alvoId);
  const idsComentario = denuncias.filter((d) => d.alvoTipo === "COMENTARIO").map((d) => d.alvoId);

  const [reclamacoes, comentarios] = await Promise.all([
    idsReclamacao.length
      ? prisma.reclamacao.findMany({
          where: { id: { in: idsReclamacao } },
          select: {
            id: true,
            protocolo: true,
            titulo: true,
            descricao: true,
            autor: { select: { name: true, email: true } },
          },
        })
      : Promise.resolve([]),
    // MIDIA fica de fora por enquanto - nada no app cria denúncia com esse
    // alvoTipo ainda, então não há o que buscar aqui.
    idsComentario.length
      ? prisma.comentario.findMany({
          where: { id: { in: idsComentario } },
          select: {
            id: true,
            texto: true,
            autor: { select: { name: true, email: true } },
            reclamacao: { select: { protocolo: true, titulo: true } },
          },
        })
      : Promise.resolve([]),
  ]);
  const reclamacaoPorId = new Map(reclamacoes.map((r) => [r.id, r]));
  const comentarioPorId = new Map(comentarios.map((c) => [c.id, c]));

  return (
    <main className={pagina}>
      <CabecalhoPagina
        kicker={tNav("kickerModeracao")}
        titulo={t("titulo")}
        descricao={t("resumoAbertas", { count: totalDenuncias })}
      />

      <div className={grade}>
        <div className={colunaPrincipal}>
          <Secao id="abertas" titulo={t("resumoRotulo")}>
            {denuncias.length === 0 && (
              <EstadoVazio
                icone={CircleCheck}
                titulo={t("nenhumaEmAberto")}
                descricao={t("nenhumaEmAbertoDesc")}
              />
            )}

            {denuncias.map((denuncia) => {
              const reclamacao =
                denuncia.alvoTipo === "RECLAMACAO" ? reclamacaoPorId.get(denuncia.alvoId) : undefined;
              const comentario =
                denuncia.alvoTipo === "COMENTARIO" ? comentarioPorId.get(denuncia.alvoId) : undefined;
              const alvoExiste = Boolean(reclamacao ?? comentario);
              // Quem postou o conteúdo denunciado: é quem o diálogo de banimento nomeia.
              const autorAlvo = reclamacao?.autor ?? comentario?.autor;
              const nomeAutor = autorAlvo ? (autorAlvo.name ?? autorAlvo.email) : "";
              const nomeDenunciante = denuncia.denunciante.name ?? denuncia.denunciante.email;

              return (
                <article key={denuncia.id} className={`flex flex-col gap-5 ${cartaoSecao}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Etiqueta tom="neutro">
                        {denuncia.alvoTipo === "COMENTARIO" ? t("tipoComentario") : t("tipoReclamacao")}
                      </Etiqueta>
                      <Etiqueta tom="erro">{tMotivo(denuncia.motivo)}</Etiqueta>
                    </div>
                    <TempoNaFila desde={denuncia.createdAt} />
                  </div>

                  {reclamacao && (
                    <h3 className="text-xl leading-snug font-extrabold tracking-tight">
                      <Link
                        href={`/reclamacoes/${reclamacao.protocolo}`}
                        className="text-ink hover:text-brand"
                      >
                        {reclamacao.titulo}
                      </Link>
                    </h3>
                  )}
                  {reclamacao && <p className={blocoCitacao}>{reclamacao.descricao}</p>}

                  {comentario && (
                    <>
                      <p className="text-sm text-ink-muted">
                        {t("comentarioDe", {
                          autor: comentario.autor.name ?? comentario.autor.email,
                        })}
                      </p>
                      <p className={blocoCitacao}>“{comentario.texto}”</p>
                      <Link
                        href={`/reclamacoes/${comentario.reclamacao.protocolo}`}
                        className="w-fit text-sm font-semibold text-brand underline underline-offset-2"
                      >
                        {t("comentarioEm", { titulo: comentario.reclamacao.titulo })}
                      </Link>
                    </>
                  )}

                  {!alvoExiste && <p className="font-medium text-ink-muted">{t("conteudoRemovido")}</p>}

                  <div className={`flex flex-col gap-2 ${painelSuave}`}>
                    <div className="flex items-center gap-2 text-sm text-ink-muted">
                      <AvatarIniciais nome={nomeDenunciante} />
                      <span>
                        {t("denunciadoPor")}{" "}
                        <span className="font-medium text-ink">{nomeDenunciante}</span> {t("em")}{" "}
                        <time dateTime={denuncia.createdAt.toISOString()}>
                          {formatarDataHora(denuncia.createdAt, locale)}
                        </time>
                      </span>
                    </div>
                    {denuncia.descricao && (
                      <p className="text-sm text-ink-2 italic">“{denuncia.descricao}”</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t border-line pt-5">
                    {/* Sem o conteúdo (já removido), "procedente" e banir não têm no que
                        agir: só resta fechar a denúncia como improcedente. */}
                    {alvoExiste && (
                      <FormularioAcao
                        action={marcarProcedente.bind(null, denuncia.id)}
                        confirmacao={
                          denuncia.alvoTipo === "COMENTARIO"
                            ? {
                                titulo: t("confirmarComentarioTitulo"),
                                descricao: t("confirmarComentarioDescricao"),
                                confirmar: t("confirmarComentarioBotao"),
                                tom: "perigo",
                              }
                            : {
                                titulo: t("confirmarReclamacaoTitulo"),
                                descricao: t("confirmarReclamacaoDescricao"),
                                confirmar: t("confirmarReclamacaoBotao"),
                                tom: "perigo",
                              }
                        }
                      >
                        <BotaoAcao className={botaoPrimario}>
                          {denuncia.alvoTipo === "COMENTARIO"
                            ? t("procedenteComentario")
                            : t("procedenteReclamacao")}
                        </BotaoAcao>
                      </FormularioAcao>
                    )}
                    <FormularioAcao action={marcarImprocedente.bind(null, denuncia.id)}>
                      <BotaoAcao className={botaoSecundario}>{t("improcedente")}</BotaoAcao>
                    </FormularioAcao>

                    {ehAdmin && alvoExiste && (
                      <FormularioAcao
                        action={banirAutor.bind(null, denuncia.id)}
                        className="flex items-center gap-2 sm:ml-auto"
                        confirmacao={{
                          titulo: t("confirmarBanirTitulo", { nome: nomeAutor }),
                          // {duracao} é o campo do formulário: o diálogo troca pelo rótulo da opção marcada.
                          descricao: t("confirmarBanirDescricao", { duracao: "{duracao}" }),
                          detalhes: [
                            t("confirmarBanirDetalheConteudo"),
                            t("confirmarBanirDetalheReverter"),
                          ],
                          confirmar: t("confirmarBanirBotao"),
                          tom: "perigo",
                          // Banimento permanente pede a senha de quem está banindo.
                          senha: { campo: "duracao", valor: "permanente" },
                        }}
                      >
                        <select
                          name="duracao"
                          defaultValue="7"
                          aria-label={t("duracaoBanimento")}
                          className={`${campoInput} py-2`}
                        >
                          <option value="7">{t("seteDias")}</option>
                          <option value="30">{t("trintaDias")}</option>
                          <option value="permanente">{t("permanente")}</option>
                        </select>
                        <BotaoAcao className={botaoPerigo}>{t("banirAutor")}</BotaoAcao>
                      </FormularioAcao>
                    )}
                  </div>
                </article>
              );
            })}

            <Paginacao paginaAtual={paginaAtual} totalPaginas={totalPaginas} basePath="/denuncias" />
          </Secao>
        </div>

        <aside className={colunaLateral}>
          <ResumoLateral
            rotulo={t("resumoRotulo")}
            valor={totalDenuncias}
            itens={[
              { rotulo: t("tipoReclamacao"), valor: contagemPorTipo.get("RECLAMACAO") ?? 0 },
              { rotulo: t("tipoComentario"), valor: contagemPorTipo.get("COMENTARIO") ?? 0 },
            ]}
          />
        </aside>
      </div>
    </main>
  );
}
