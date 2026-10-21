import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ChevronRight, ExternalLink, MessageSquare } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Aviso } from "@/components/aviso";
import { StatusBadge } from "@/components/status-badge";
import { FormularioDenuncia } from "@/components/formulario-denuncia";
import {
  botaoPrimario,
  botaoSecundario,
  campoInput,
  cartao,
  containerLargo,
  painelSuave,
} from "@/lib/estilos";
import { formatarDataHora } from "@/lib/formatarData";
import { orgaoAtendeCategoria } from "@/lib/orgaoCategoria";
import { STATUS_PUBLICOS } from "@/lib/statusPublicos";
import { iniciaisDoNome } from "@/lib/texto";
import { formatarTempoRelativo } from "@/lib/tempo-relativo";

import {
  alternarConfirmacao,
  avaliarReclamacao,
  contestarRejeicao,
  criarDenuncia,
  criarDenunciaComentario,
  responderReclamacao,
} from "./actions";
import { criarComentario } from "./comentarios";
import { construirLinhaDoTempo } from "./linha-do-tempo";
import { LinhaDoTempoVisual } from "./linha-do-tempo-visual";
import { ResumoReclamacao } from "./resumo-reclamacao";

// Compartilhada entre a página e o generateMetadata: a mesma consulta (e o
// mesmo resultado) serve aos dois dentro da requisição, em vez de dois idas
// ao banco pra uma rota pública de alto tráfego.
const buscarReclamacao = cache((protocolo: string) =>
  prisma.reclamacao.findUnique({
    where: { protocolo },
    include: {
      categoria: true,
      cidade: { include: { estado: true } },
      _count: { select: { confirmacoes: true } },
      respostas: { include: { orgao: true }, orderBy: { createdAt: "asc" } },
      avaliacao: true,
      midias: { orderBy: { ordem: "asc" } },
    },
  })
);

export async function generateMetadata({
  params,
}: PageProps<"/reclamacoes/[protocolo]">): Promise<Metadata> {
  const { protocolo } = await params;
  const t = await getTranslations("ReclamacaoDetalhe");
  const reclamacao = await buscarReclamacao(protocolo);

  // Só reclamação PÚBLICA empresta título e descrição pro <title>/OG. A
  // página também mostra reclamações não publicadas ao autor e a moderadores,
  // mas o <title> sairia no HTML pra qualquer um que soubesse o protocolo
  // (inclusive na resposta de 404) - rascunho e rejeitada não podem vazar.
  if (!reclamacao || !(STATUS_PUBLICOS as readonly string[]).includes(reclamacao.status)) {
    return { title: t("tituloGenerico") };
  }

  const descricao = reclamacao.descricao.slice(0, 160);
  return {
    title: reclamacao.titulo,
    description: descricao,
    openGraph: { title: reclamacao.titulo, description: descricao, type: "article" },
  };
}

export default async function ReclamacaoPage({
  params,
  searchParams,
}: PageProps<"/reclamacoes/[protocolo]">) {
  const t = await getTranslations("ReclamacaoDetalhe");
  const locale = await getLocale();
  const { protocolo } = await params;
  const { erro } = await searchParams;

  const reclamacao = await buscarReclamacao(protocolo);

  const session = await auth();
  const ehAutor = reclamacao?.autorId === session?.user?.id;
  const ehModerador =
    session?.user?.papel === "MODERADOR" || session?.user?.papel === "ADMIN";
  const publicaOuAutor =
    reclamacao?.status === "PUBLICADA" ||
    reclamacao?.status === "EM_ANDAMENTO" ||
    reclamacao?.status === "RESOLVIDA" ||
    reclamacao?.status === "ARQUIVADA" ||
    ehAutor ||
    ehModerador;

  if (!reclamacao || !publicaOuAutor) {
    notFound();
  }

  // Nenhuma das 4 consultas abaixo depende do resultado de outra - rodam
  // em paralelo em vez de uma esperar a outra, o que só somava latência à
  // toa numa rota de alto tráfego e acessível por qualquer visitante.
  const [confirmacaoDoUsuario, orgaoDoUsuario, denunciaDoUsuario, comentarios] =
    await Promise.all([
      session?.user
        ? prisma.confirmacao.findUnique({
            where: {
              userId_reclamacaoId: {
                userId: session.user.id,
                reclamacaoId: reclamacao.id,
              },
            },
          })
        : Promise.resolve(null),
      session?.user?.papel === "ORGAO" && session.user.orgaoId
        ? prisma.orgao.findUnique({
            where: { id: session.user.orgaoId },
            include: { categorias: { select: { id: true } } },
          })
        : Promise.resolve(null),
      session?.user && !ehAutor
        ? prisma.denuncia.findFirst({
            where: {
              denuncianteId: session.user.id,
              alvoTipo: "RECLAMACAO",
              alvoId: reclamacao.id,
              status: "ABERTA",
            },
          })
        : Promise.resolve(null),
      prisma.comentario.findMany({
        where: { reclamacaoId: reclamacao.id, paiId: null, statusModeracao: "APROVADO" },
        orderBy: { createdAt: "asc" },
        include: {
          autor: true,
          respostas: {
            where: { statusModeracao: "APROVADO" },
            orderBy: { createdAt: "asc" },
            include: { autor: true },
          },
        },
      }),
    ]);

  const jaConfirmou = confirmacaoDoUsuario !== null;
  const denunciaAberta = denunciaDoUsuario !== null;

  const podeResponder =
    !!orgaoDoUsuario?.ativo &&
    orgaoDoUsuario.cidadeId === reclamacao.cidadeId &&
    orgaoAtendeCategoria(orgaoDoUsuario.categorias, reclamacao.categoriaId) &&
    (reclamacao.status === "PUBLICADA" || reclamacao.status === "EM_ANDAMENTO");

  const podeAvaliar =
    ehAutor && reclamacao.status === "RESOLVIDA" && !reclamacao.avaliacao;

  const linhaDoTempo = construirLinhaDoTempo(
    reclamacao,
    reclamacao.respostas,
    reclamacao.avaliacao,
    t,
    await getTranslations("Status")
  );

  // A ação principal da coluna lateral depende de quem está olhando: quem
  // não é o autor confirma ("também sofro"); visitante deslogado é chamado
  // a entrar; o autor não confirma a própria reclamação.
  const acaoConfirmar = session?.user ? (
    !ehAutor && (
      <form action={alternarConfirmacao.bind(null, reclamacao.id, protocolo)}>
        <button
          type="submit"
          aria-pressed={jaConfirmou}
          className={`${jaConfirmou ? botaoSecundario : botaoPrimario} w-full`}
        >
          {jaConfirmou && <Check className="h-4 w-4" aria-hidden />}
          {t("tambemSofro")}
        </button>
      </form>
    )
  ) : (
    <Link
      href={`/login?callbackUrl=${encodeURIComponent(`/reclamacoes/${protocolo}`)}`}
      className={`${botaoSecundario} w-full`}
    >
      {t("entreParaConfirmar")}
    </Link>
  );

  return (
    <main className={containerLargo}>
      <header className="flex flex-col gap-3">
        <nav aria-label={t("navegacaoRotulo")}>
          <ol className="flex flex-wrap items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
            <li>
              <Link href="/reclamacoes" className="hover:text-primary hover:underline">
                {t("reclamacoesRotulo")}
              </Link>
            </li>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            <li>
              <Link
                href={`/cidades/${reclamacao.cidade.slug}`}
                className="hover:text-primary hover:underline"
              >
                {reclamacao.cidade.nome}
              </Link>
            </li>
          </ol>
        </nav>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100">
          {reclamacao.titulo}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <StatusBadge status={reclamacao.status} />
          {/* Borda tracejada + mono, tipo canhoto de ticket - separa
              visualmente "isto é um código de registro" de "isto é um
              estado" (StatusBadge, ao lado), em vez dos dois competirem
              pelo mesmo tratamento de pílula arredondada. */}
          <span className="inline-flex items-center gap-1.5 rounded border border-dashed border-slate-300 px-2 py-0.5 dark:border-slate-700">
            <span className="text-xs text-slate-400 dark:text-slate-500">{t("protocolo")}</span>
            <span className="font-mono text-xs tracking-tight text-slate-600 dark:text-slate-400">
              {reclamacao.protocolo}
            </span>
          </span>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        {/* Resumo primeiro no celular (status, local, confirmar são o que a
            pessoa procura de cara), à direita e fixo no desktop. */}
        <aside className="lg:sticky lg:top-20 lg:order-last">
          <ResumoReclamacao
            status={reclamacao.status}
            categoria={{ nome: reclamacao.categoria.nome, icone: reclamacao.categoria.icone }}
            cidade={{
              nome: reclamacao.cidade.nome,
              slug: reclamacao.cidade.slug,
              uf: reclamacao.cidade.estado.uf,
            }}
            endereco={reclamacao.endereco}
            criadaEm={reclamacao.createdAt}
            confirmacoes={reclamacao._count.confirmacoes}
            locale={locale}
            acao={acaoConfirmar}
            acaoSecundaria={
              !ehAutor &&
              session?.user &&
              !denunciaAberta && (
                <FormularioDenuncia
                  action={criarDenuncia.bind(null, reclamacao.id, protocolo)}
                  largura="w-full"
                />
              )
            }
          />
        </aside>

        <div className="flex min-w-0 flex-col gap-8">
          <section className="flex flex-col gap-4">
            <p className="text-base leading-relaxed whitespace-pre-line text-slate-800 dark:text-slate-200">
              {reclamacao.descricao}
            </p>

            {reclamacao.midias.length > 0 && (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {reclamacao.midias.map((midia, indice) => {
                  // Sempre a versão tratada (rostos e placas desfocados) quando
                  // existe - o link abre a mesma imagem que a miniatura, nunca
                  // o original.
                  const src = midia.urlTratada ?? midia.url;
                  return (
                    <li key={midia.id}>
                      <a
                        href={src}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t("abrirFoto", { numero: indice + 1 })}
                        className="group relative block aspect-square overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- imagem externa (Vercel Blob), sem domínio fixo pra configurar no next/image */}
                        <img
                          src={src}
                          alt=""
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <span className="absolute right-2 bottom-2 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/70 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}

            {reclamacao.status === "REJEITADA" && reclamacao.motivoRejeicao && (
              <Aviso tom="erro">
                <span className="font-medium">{t("motivoRejeicao")}</span> {reclamacao.motivoRejeicao}
              </Aviso>
            )}
            {reclamacao.status === "REJEITADA" && ehAutor && !reclamacao.emRecurso && (
              <form
                action={contestarRejeicao.bind(null, reclamacao.id, protocolo)}
                className={`flex flex-col gap-2 ${painelSuave}`}
              >
                <p className="text-sm text-slate-600 dark:text-slate-400">{t("contestarDesc")}</p>
                <textarea
                  name="texto"
                  required
                  minLength={20}
                  placeholder={t("contestarPlaceholder")}
                  rows={3}
                  className={campoInput}
                />
                <button type="submit" className={`${botaoSecundario} w-fit`}>
                  {t("contestarRejeicao")}
                </button>
              </form>
            )}
            {reclamacao.status === "REJEITADA" && ehAutor && reclamacao.emRecurso && (
              <Aviso tom="info">{t("jaContestou")}</Aviso>
            )}
            {reclamacao.status === "AGUARDANDO_REVISAO" && (
              <Aviso tom="atencao">
                {reclamacao.emRecurso ? t("recursoEmAnalise") : t("encaminhadaRevisao")}
              </Aviso>
            )}
            {erro === "email-nao-verificado" && (
              <Aviso tom="atencao">
                {t("verifiqueEmail")}{" "}
                <Link href="/painel" className="font-medium underline">
                  {t("seuPainel")}
                </Link>
                .
              </Aviso>
            )}

          </section>

          {linhaDoTempo.length > 1 && (
            <section className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {t("linhaDoTempo")}
              </h2>
              <LinhaDoTempoVisual eventos={linhaDoTempo} locale={locale} />
            </section>
          )}

          {podeResponder && (
            <form
              action={responderReclamacao.bind(null, reclamacao.id, protocolo)}
              className={`flex flex-col gap-2 ${cartao}`}
            >
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                {t("responderComoOrgao")}
              </h2>
              <textarea
                name="texto"
                required
                minLength={10}
                placeholder={t("respostaOficial")}
                rows={3}
                className={campoInput}
              />
              <select name="novoStatus" defaultValue="" className={campoInput}>
                <option value="">{t("manterStatus")}</option>
                <option value="EM_ANDAMENTO">{t("marcarEmAndamento")}</option>
                <option value="RESOLVIDA">{t("marcarResolvida")}</option>
              </select>
              <input type="date" name="prazoEstimado" className={campoInput} />
              <button type="submit" className={`${botaoPrimario} w-fit`}>
                {t("enviarResposta")}
              </button>
            </form>
          )}

          {podeAvaliar && (
            <form
              action={avaliarReclamacao.bind(null, reclamacao.id, protocolo)}
              className={`flex flex-col gap-2 ${cartao}`}
            >
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                {t("foiRealmenteResolvido")}
              </h2>
              <select name="nota" required defaultValue="" className={campoInput}>
                <option value="" disabled>
                  {t("notaUmACinco")}
                </option>
                {[1, 2, 3, 4, 5].map((nota) => (
                  <option key={nota} value={nota}>
                    {nota}
                  </option>
                ))}
              </select>
              <div className="flex gap-4 text-sm text-slate-700 dark:text-slate-300">
                <label className="flex items-center gap-1">
                  <input type="radio" name="resolvido" value="true" required />
                  {t("simFoiResolvido")}
                </label>
                <label className="flex items-center gap-1">
                  <input type="radio" name="resolvido" value="false" required />
                  {t("naoFoiResolvido")}
                </label>
              </div>
              <textarea
                name="comentario"
                placeholder={t("comentarioOpcional")}
                rows={2}
                className={campoInput}
              />
              <button type="submit" className={`${botaoPrimario} w-fit`}>
                {t("enviarAvaliacao")}
              </button>
            </form>
          )}

          <section className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t("comentarios")} {comentarios.length > 0 && `(${comentarios.length})`}
            </h2>

            {session?.user ? (
              <form
                action={criarComentario.bind(null, reclamacao.id, protocolo)}
                className="flex flex-col gap-2"
              >
                <textarea
                  name="texto"
                  required
                  minLength={3}
                  maxLength={1000}
                  placeholder={t("deixeComentario")}
                  rows={2}
                  className={campoInput}
                />
                <button type="submit" className={`${botaoSecundario} w-fit`}>
                  {t("comentar")}
                </button>
              </form>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                <Link
                  href={`/login?callbackUrl=${encodeURIComponent(`/reclamacoes/${protocolo}`)}`}
                  className="font-medium text-primary hover:underline"
                >
                  {t("entreParaComentar")}
                </Link>
              </p>
            )}

            {comentarios.length === 0 && (
              <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <MessageSquare className="h-4 w-4 shrink-0" aria-hidden />
                {t("nenhumComentario")}
              </p>
            )}

            {comentarios.length > 0 && (
              <div className="flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
                {comentarios.map((comentario) => {
                  const nomeAutor = comentario.autor.name ?? comentario.autor.email;
                  return (
                    <article key={comentario.id} className="flex gap-3 py-5 first:pt-0 last:pb-0">
                      <span
                        aria-hidden
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                      >
                        {iniciaisDoNome(nomeAutor)}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {nomeAutor}
                          <time
                            dateTime={comentario.createdAt.toISOString()}
                            title={formatarDataHora(comentario.createdAt, locale)}
                            className="ml-2 font-normal text-slate-400 dark:text-slate-500"
                          >
                            {formatarTempoRelativo(comentario.createdAt, locale)}
                          </time>
                        </p>
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          {comentario.texto}
                        </p>

                        {session?.user && (
                          <div className="flex flex-wrap items-center gap-3">
                            <details>
                              <summary className="w-fit cursor-pointer text-xs text-primary">
                                {t("responder")}
                              </summary>
                              <form
                                action={criarComentario.bind(null, reclamacao.id, protocolo)}
                                className="animate-fade-in mt-2 flex flex-col gap-2"
                              >
                                <input type="hidden" name="paiId" value={comentario.id} />
                                <textarea
                                  name="texto"
                                  required
                                  minLength={3}
                                  maxLength={1000}
                                  placeholder={t("escrevaResposta")}
                                  rows={2}
                                  className={campoInput}
                                />
                                <button type="submit" className={`${botaoSecundario} w-fit`}>
                                  {t("responder")}
                                </button>
                              </form>
                            </details>

                            {comentario.autor.id !== session.user.id && (
                              <FormularioDenuncia
                                action={criarDenunciaComentario.bind(null, comentario.id, protocolo)}
                                largura="w-64"
                              />
                            )}
                          </div>
                        )}

                        {comentario.respostas.length > 0 && (
                          <div className="mt-1 flex flex-col gap-3 border-l border-slate-200 pl-4 dark:border-slate-700">
                            {comentario.respostas.map((resposta) => (
                              <div key={resposta.id}>
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                  {resposta.autor.name ?? resposta.autor.email}
                                  <time
                                    dateTime={resposta.createdAt.toISOString()}
                                    title={formatarDataHora(resposta.createdAt, locale)}
                                    className="ml-2 font-normal text-slate-400 dark:text-slate-500"
                                  >
                                    {formatarTempoRelativo(resposta.createdAt, locale)}
                                  </time>
                                </p>
                                <p className="text-sm text-slate-700 dark:text-slate-300">
                                  {resposta.texto}
                                </p>
                                {session?.user && resposta.autor.id !== session.user.id && (
                                  <FormularioDenuncia
                                    action={criarDenunciaComentario.bind(null, resposta.id, protocolo)}
                                    largura="w-64"
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
