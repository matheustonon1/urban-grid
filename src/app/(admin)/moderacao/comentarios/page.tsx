import Link from "next/link";
import { CircleCheck, History } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { AvatarIniciais } from "@/components/ui/avatar-iniciais";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { DecisaoBadge } from "@/components/moderacao/decisao-badge";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Paginacao } from "@/components/ui/paginacao";
import { PontuacoesIA } from "@/components/moderacao/pontuacoes-ia";
import { TempoNaFila } from "@/components/moderacao/tempo-na-fila";
import { calcularSkip, calcularTotalPaginas, ITENS_POR_PAGINA, lerPaginaAtual } from "@/lib/util/paginacao";
import {
  blocoCitacao,
  botaoPerigo,
  botaoPrimario,
  botaoSecundario,
  cartao,
  containerPagina,
  rotuloSecao,
} from "@/lib/estilos";
import { metadataDaPagina } from "@/lib/metadata";

import { aprovarComentarioReprovado, confirmarRejeicaoComentario } from "./actions";
import { exigirModerador } from "../exigir-moderador";

export const generateMetadata = metadataDaPagina("ModeracaoComentarios");

const rotuloEixo = (rotulo: string) => rotulo.replace(/:\s*$/, "");

export default async function ModeracaoComentariosPage({
  searchParams,
}: PageProps<"/moderacao/comentarios">) {
  const t = await getTranslations("ModeracaoComentarios");
  const tMod = await getTranslations("Moderacao");
  const tHist = await getTranslations("HistoricoModeracao");
  await exigirModerador();

  const { page } = await searchParams;
  const paginaAtual = lerPaginaAtual(page);
  const filtro = { alvoTipo: "COMENTARIO" as const, decisao: "REPROVAR" as const, revisadoEm: null };

  const [logsPendentes, totalPendentes] = await Promise.all([
    prisma.logModeracao.findMany({
      where: filtro,
      orderBy: { createdAt: "asc" },
      skip: calcularSkip(paginaAtual),
      take: ITENS_POR_PAGINA,
    }),
    prisma.logModeracao.count({ where: filtro }),
  ]);
  const totalPaginas = calcularTotalPaginas(totalPendentes);

  const comentarios = logsPendentes.length
    ? await prisma.comentario.findMany({
        where: { id: { in: logsPendentes.map((log) => log.alvoId) } },
        include: { autor: true, reclamacao: { select: { protocolo: true, titulo: true } } },
      })
    : [];
  const comentarioPorId = new Map(comentarios.map((c) => [c.id, c]));

  return (
    <main className={`${containerPagina} max-w-3xl`}>
      <CabecalhoPagina
        titulo={t("titulo")}
        descricao={t("descricao")}
        acoes={
          <Link href="/moderacao/historico/comentarios" className={botaoSecundario}>
            <History className="h-4 w-4" aria-hidden />
            {tMod("verHistorico")}
          </Link>
        }
      />

      {logsPendentes.length === 0 && (
        <EstadoVazio
          icone={CircleCheck}
          titulo={t("nenhumPendente")}
          descricao={t("nenhumPendenteDesc")}
        />
      )}

      {logsPendentes.map((log) => {
        const comentario = comentarioPorId.get(log.alvoId);
        if (!comentario) return null;
        const nomeAutor = comentario.autor.name ?? comentario.autor.email;

        return (
          <div key={log.id} className={`flex flex-col gap-4 ${cartao}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <DecisaoBadge decisao="REPROVAR" origem={tHist("ia")} />
              <TempoNaFila desde={log.createdAt} />
            </div>

            <div className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-400">
              <AvatarIniciais nome={nomeAutor} />
              <p>
                <span className="font-medium text-slate-900 dark:text-slate-100">{nomeAutor}</span>{" "}
                {t("em")}{" "}
                <Link
                  href={`/reclamacoes/${comentario.reclamacao.protocolo}`}
                  className="text-primary hover:underline"
                >
                  {comentario.reclamacao.titulo}
                </Link>
                {comentario.paiId && ` · ${t("respostaAOutroComentario")}`}
              </p>
            </div>

            <p className={blocoCitacao}>{comentario.texto}</p>

            <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <p className={rotuloSecao}>{tMod("analiseIA")}</p>
              <PontuacoesIA
                itens={[
                  { rotulo: tMod("geral"), valor: log.scoreGeral, destaque: true },
                  { rotulo: rotuloEixo(tMod("ofensivo")), valor: log.scoreOfensivo },
                  { rotulo: rotuloEixo(tMod("spam")), valor: log.scoreSpam },
                  { rotulo: rotuloEixo(tMod("dadosPessoais")), valor: log.scoreDadosPessoais },
                ]}
              />
              {log.justificativa && (
                <p className="text-sm text-slate-600 italic dark:text-slate-300">
                  “{log.justificativa}”
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
              <form action={aprovarComentarioReprovado.bind(null, comentario.id)}>
                <button type="submit" className={botaoPrimario}>
                  {t("aprovarMesmoAssim")}
                </button>
              </form>
              <form action={confirmarRejeicaoComentario.bind(null, comentario.id)}>
                <button type="submit" className={botaoPerigo}>
                  {t("confirmarRejeicao")}
                </button>
              </form>
            </div>
          </div>
        );
      })}

      <Paginacao
        paginaAtual={paginaAtual}
        totalPaginas={totalPaginas}
        basePath="/moderacao/comentarios"
      />
    </main>
  );
}
