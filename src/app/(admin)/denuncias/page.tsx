import Link from "next/link";
import { CircleCheck, Flag } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { AvatarIniciais } from "@/components/ui/avatar-iniciais";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Paginacao } from "@/components/ui/paginacao";
import { TempoNaFila } from "@/components/moderacao/tempo-na-fila";
import { calcularSkip, calcularTotalPaginas, ITENS_POR_PAGINA, lerPaginaAtual } from "@/lib/util/paginacao";
import {
  blocoCitacao,
  botaoPerigo,
  botaoPrimario,
  botaoSecundario,
  campoInput,
  cartao,
  containerPagina,
} from "@/lib/estilos";
import { formatarDataHora } from "@/lib/util/formatarData";
import { metadataDaPagina } from "@/lib/metadata";

import { exigirModerador } from "../moderacao/exigir-moderador";
import { banirAutor, marcarImprocedente, marcarProcedente } from "./actions";

export const generateMetadata = metadataDaPagina("Denuncias");

export default async function DenunciasPage({ searchParams }: PageProps<"/denuncias">) {
  const t = await getTranslations("Denuncias");
  const tMotivo = await getTranslations("MotivoDenuncia");
  const locale = await getLocale();
  const session = await exigirModerador();
  const ehAdmin = session.user.papel === "ADMIN";

  const { page } = await searchParams;
  const paginaAtual = lerPaginaAtual(page);
  const filtro = { status: "ABERTA" as const };

  const [denuncias, totalDenuncias] = await Promise.all([
    prisma.denuncia.findMany({
      where: filtro,
      orderBy: { createdAt: "asc" },
      include: { denunciante: true },
      skip: calcularSkip(paginaAtual),
      take: ITENS_POR_PAGINA,
    }),
    prisma.denuncia.count({ where: filtro }),
  ]);
  const totalPaginas = calcularTotalPaginas(totalDenuncias);

  const idsReclamacao = denuncias.filter((d) => d.alvoTipo === "RECLAMACAO").map((d) => d.alvoId);
  const idsComentario = denuncias.filter((d) => d.alvoTipo === "COMENTARIO").map((d) => d.alvoId);

  const [reclamacoes, comentarios] = await Promise.all([
    idsReclamacao.length
      ? prisma.reclamacao.findMany({
          where: { id: { in: idsReclamacao } },
          select: { id: true, protocolo: true, titulo: true, descricao: true },
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
    <main className={`${containerPagina} max-w-3xl`}>
      <CabecalhoPagina
        titulo={t("titulo")}
        descricao={t("resumoAbertas", { count: totalDenuncias })}
      />

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
        const nomeDenunciante = denuncia.denunciante.name ?? denuncia.denunciante.email;

        return (
          <div key={denuncia.id} className={`flex flex-col gap-4 ${cartao}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-sunken px-2.5 py-0.5 text-xs font-medium text-ink-2">
                  {denuncia.alvoTipo === "COMENTARIO" ? t("tipoComentario") : t("tipoReclamacao")}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-medium text-danger-ink">
                  <Flag className="h-3 w-3" aria-hidden />
                  {tMotivo(denuncia.motivo)}
                </span>
              </div>
              <TempoNaFila desde={denuncia.createdAt} />
            </div>

            {reclamacao && (
              <Link
                href={`/reclamacoes/${reclamacao.protocolo}`}
                className="text-lg leading-snug font-semibold text-ink hover:text-brand"
              >
                {reclamacao.titulo}
              </Link>
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
                  className="text-sm text-brand hover:underline"
                >
                  {t("comentarioEm", { titulo: comentario.reclamacao.titulo })}
                </Link>
              </>
            )}

            {!alvoExiste && (
              <p className="font-medium text-ink-muted">
                {t("conteudoRemovido")}
              </p>
            )}

            <div className="flex flex-col gap-2 rounded-lg border border-line p-3.5">
              <div className="flex items-center gap-2 text-sm text-ink-muted">
                <AvatarIniciais nome={nomeDenunciante} />
                <span>
                  {t("denunciadoPor")}{" "}
                  <span className="font-medium text-ink">
                    {nomeDenunciante}
                  </span>{" "}
                  {t("em")}{" "}
                  <time dateTime={denuncia.createdAt.toISOString()}>
                    {formatarDataHora(denuncia.createdAt, locale)}
                  </time>
                </span>
              </div>
              {denuncia.descricao && (
                <p className="text-sm text-ink-2 italic">
                  “{denuncia.descricao}”
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
              <form action={marcarProcedente.bind(null, denuncia.id)}>
                <button type="submit" className={botaoPrimario}>
                  {denuncia.alvoTipo === "COMENTARIO"
                    ? t("procedenteComentario")
                    : t("procedenteReclamacao")}
                </button>
              </form>
              <form action={marcarImprocedente.bind(null, denuncia.id)}>
                <button type="submit" className={botaoSecundario}>
                  {t("improcedente")}
                </button>
              </form>

              {ehAdmin && (
                <form
                  action={banirAutor.bind(null, denuncia.id)}
                  className="flex items-center gap-2 sm:ml-auto"
                >
                  <select name="duracao" defaultValue="7" className={`${campoInput} py-1.5`}>
                    <option value="7">{t("seteDias")}</option>
                    <option value="30">{t("trintaDias")}</option>
                    <option value="permanente">{t("permanente")}</option>
                  </select>
                  <button type="submit" className={botaoPerigo}>
                    {t("banirAutor")}
                  </button>
                </form>
              )}
            </div>
          </div>
        );
      })}

      <Paginacao paginaAtual={paginaAtual} totalPaginas={totalPaginas} basePath="/denuncias" />
    </main>
  );
}
