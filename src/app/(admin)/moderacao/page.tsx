import Link from "next/link";
import { CircleCheck, History, MapPin } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { Aviso } from "@/components/aviso";
import { AvatarIniciais } from "@/components/avatar-iniciais";
import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { EstadoVazio } from "@/components/estado-vazio";
import { Paginacao } from "@/components/paginacao";
import { PontuacoesIA } from "@/components/pontuacoes-ia";
import { TempoNaFila } from "@/components/tempo-na-fila";
import { calcularSkip, calcularTotalPaginas, ITENS_POR_PAGINA, lerPaginaAtual } from "@/lib/paginacao";
import {
  blocoCitacao,
  botaoPerigo,
  botaoPrimario,
  botaoSecundario,
  campoInput,
  cartao,
  containerPagina,
  rotuloSecao,
} from "@/lib/estilos";
import { metadataDaPagina } from "@/lib/metadata";

import { aprovarReclamacao, rejeitarReclamacao } from "./actions";
import { exigirModerador } from "./exigir-moderador";

export const generateMetadata = metadataDaPagina("Moderacao");

type Origem = "ia" | "recurso" | "falha";

const ESTILO_ORIGEM: Record<Origem, string> = {
  ia: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  recurso: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  falha: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

// As mensagens dos eixos trazem ":" no fim (herança do formato em texto
// corrido); na barra o rótulo fica sem ele.
const rotuloEixo = (rotulo: string) => rotulo.replace(/:\s*$/, "");

export default async function ModeracaoPage({ searchParams }: PageProps<"/moderacao">) {
  const t = await getTranslations("Moderacao");
  await exigirModerador();

  const { page } = await searchParams;
  const paginaAtual = lerPaginaAtual(page);
  const filtro = { status: "AGUARDANDO_REVISAO" as const };

  const [pendentes, totalPendentes] = await Promise.all([
    prisma.reclamacao.findMany({
      where: filtro,
      orderBy: { updatedAt: "asc" },
      include: {
        categoria: true,
        cidade: { include: { estado: true } },
        autor: true,
        midias: { orderBy: { ordem: "asc" } },
      },
      skip: calcularSkip(paginaAtual),
      take: ITENS_POR_PAGINA,
    }),
    prisma.reclamacao.count({ where: filtro }),
  ]);
  const totalPaginas = calcularTotalPaginas(totalPendentes);

  const logs = pendentes.length
    ? await prisma.logModeracao.findMany({
        where: {
          alvoTipo: "RECLAMACAO",
          alvoId: { in: pendentes.map((reclamacao) => reclamacao.id) },
          decisao: "ENCAMINHAR_REVISAO",
          revisadoEm: null,
        },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const logPorReclamacao = new Map(logs.map((log) => [log.alvoId, log]));

  return (
    <main className={`${containerPagina} max-w-3xl`}>
      <CabecalhoPagina
        titulo={t("titulo")}
        descricao={t("resumoPendentes", { count: totalPendentes })}
        acoes={
          <Link href="/moderacao/historico" className={botaoSecundario}>
            <History className="h-4 w-4" aria-hidden />
            {t("verHistorico")}
          </Link>
        }
      />

      {pendentes.length === 0 && (
        <EstadoVazio
          icone={CircleCheck}
          titulo={t("nenhumaPendente")}
          descricao={t("nenhumaPendenteDesc")}
        />
      )}

      {pendentes.map((reclamacao) => {
        const log = logPorReclamacao.get(reclamacao.id);
        const blurPendente = reclamacao.midias.some(
          (midia) => midia.statusModeracao === "REVISAO_HUMANA" && !midia.urlTratada
        );
        // Por que esta reclamação está na fila: contestação do autor, análise
        // da IA que pediu olho humano, ou (sem nenhum dos dois) falha no
        // processamento automático - o moderador precisa saber qual é o caso.
        const origem: Origem = reclamacao.emRecurso ? "recurso" : log ? "ia" : "falha";
        const nomeAutor = reclamacao.autor.name ?? reclamacao.autor.email;

        return (
          <div key={reclamacao.id} className={`flex flex-col gap-4 ${cartao}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ESTILO_ORIGEM[origem]}`}
              >
                {t(`origem_${origem}`)}
              </span>
              <TempoNaFila desde={reclamacao.updatedAt} />
            </div>

            <p className="text-lg leading-snug font-semibold text-slate-900 dark:text-slate-100">
              {reclamacao.titulo}
            </p>
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-slate-500 dark:text-slate-400">
              <span className="font-mono text-xs">{reclamacao.protocolo}</span> ·{" "}
              {reclamacao.categoria.nome}
              <span aria-hidden>·</span>
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {reclamacao.endereco} - {reclamacao.cidade.nome}/{reclamacao.cidade.estado.uf}
            </p>

            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <AvatarIniciais nome={nomeAutor} />
              <span>
                {t("autor")} <span className="font-medium">{nomeAutor}</span>
              </span>
            </div>

            <p className={blocoCitacao}>{reclamacao.descricao}</p>

            {reclamacao.midias.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {reclamacao.midias.map((midia) => (
                  // eslint-disable-next-line @next/next/no-img-element -- imagem externa (Vercel Blob), sem domínio fixo pra configurar no next/image
                  <img
                    key={midia.id}
                    src={midia.urlTratada ?? midia.url}
                    alt=""
                    className="aspect-square w-full rounded-lg border border-slate-200 object-cover dark:border-slate-700"
                  />
                ))}
              </div>
            )}

            {reclamacao.emRecurso && (
              <Aviso tom="info">
                <p className="font-medium">{t("recursoContraRejeicao")}</p>
                {reclamacao.motivoRejeicao && (
                  <p>
                    {t("motivoOriginalRejeicao")} {reclamacao.motivoRejeicao}
                  </p>
                )}
                {reclamacao.textoRecurso && (
                  <p className="mt-1 italic">
                    {t("argumentoAutor")} “{reclamacao.textoRecurso}”
                  </p>
                )}
              </Aviso>
            )}

            {log && (
              <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                <p className={rotuloSecao}>{t("analiseIA")}</p>
                <PontuacoesIA
                  itens={[
                    { rotulo: t("geral"), valor: log.scoreGeral, destaque: true },
                    { rotulo: rotuloEixo(t("ofensivo")), valor: log.scoreOfensivo },
                    { rotulo: rotuloEixo(t("spam")), valor: log.scoreSpam },
                    { rotulo: rotuloEixo(t("dadosPessoais")), valor: log.scoreDadosPessoais },
                    { rotulo: rotuloEixo(t("foraDeEscopo")), valor: log.scoreForaEscopo },
                    { rotulo: rotuloEixo(t("desinformacao")), valor: log.scoreDesinformacao },
                    {
                      rotulo: rotuloEixo(t("coerenciaTextoImagem")),
                      valor: log.coerenciaTextoImagem,
                      invertido: true,
                    },
                  ]}
                />
                {log.justificativa && (
                  <p className="text-sm text-slate-600 italic dark:text-slate-300">
                    “{log.justificativa}”
                  </p>
                )}
              </div>
            )}

            {origem === "falha" && <Aviso tom="atencao">{t("semAnaliseIA")}</Aviso>}

            {blurPendente && <Aviso tom="erro">{t("desfoquePendenteDesc")}</Aviso>}

            <div className="grid gap-4 border-t border-slate-200 pt-4 sm:grid-cols-[auto_1fr] dark:border-slate-800">
              <form action={aprovarReclamacao.bind(null, reclamacao.id)}>
                <button
                  type="submit"
                  disabled={blurPendente}
                  title={blurPendente ? t("desfoquePendenteTitulo") : undefined}
                  className={`${botaoPrimario} w-full sm:w-auto`}
                >
                  {t("aprovar")}
                </button>
              </form>

              <form
                action={rejeitarReclamacao.bind(null, reclamacao.id)}
                className="flex flex-col gap-2 sm:flex-row"
              >
                <label htmlFor={`motivo-${reclamacao.id}`} className="sr-only">
                  {t("motivoRejeicaoPlaceholder")}
                </label>
                <textarea
                  id={`motivo-${reclamacao.id}`}
                  name="motivo"
                  required
                  minLength={10}
                  placeholder={t("motivoRejeicaoPlaceholder")}
                  rows={1}
                  className={`flex-1 ${campoInput}`}
                />
                <button type="submit" className={botaoPerigo}>
                  {t("rejeitar")}
                </button>
              </form>
            </div>
          </div>
        );
      })}

      <Paginacao paginaAtual={paginaAtual} totalPaginas={totalPaginas} basePath="/moderacao" />
    </main>
  );
}
