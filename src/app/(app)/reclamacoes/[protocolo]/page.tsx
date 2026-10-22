import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ChevronRight, ExternalLink, MessageSquare } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Campo } from "@/components/formulario/campo";
import { FormularioDenuncia } from "@/components/reclamacao/formulario-denuncia";
import { PlacaProtocolo } from "@/components/reclamacao/placa-protocolo";
import { RespostaOficial } from "@/components/reclamacao/resposta-oficial";
import { StatusBadge } from "@/components/reclamacao/status-badge";
import { Aviso } from "@/components/ui/aviso";
import { AvatarIniciais } from "@/components/ui/avatar-iniciais";
import { Secao } from "@/components/ui/secao";
import {
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
import { orgaoAtendeCategoria } from "@/lib/orgaos/orgaoCategoria";
import { STATUS_PUBLICOS } from "@/lib/reclamacoes/statusPublicos";
import { formatarTempoRelativo } from "@/lib/util/tempo-relativo";

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
    <main className={pagina}>
      <header className="flex flex-col gap-5">
        <nav aria-label={t("navegacaoRotulo")}>
          <ol className="flex flex-wrap items-center gap-1 text-sm text-ink-muted">
            <li>
              <Link href="/reclamacoes" className="hover:text-brand hover:underline">
                {t("reclamacoesRotulo")}
              </Link>
            </li>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            <li>
              <Link
                href={`/cidades/${reclamacao.cidade.slug}`}
                className="hover:text-brand hover:underline"
              >
                {reclamacao.cidade.nome}
              </Link>
            </li>
          </ol>
        </nav>
        <h1 className="max-w-4xl text-3xl leading-[1.1] font-extrabold tracking-tight text-ink sm:text-5xl">
          {reclamacao.titulo}
        </h1>
        <div className="flex flex-wrap items-center gap-3 border-b-2 border-ink pb-6">
          <StatusBadge status={reclamacao.status} />
          <PlacaProtocolo protocolo={reclamacao.protocolo} rotulo={t("protocolo")} />
        </div>
      </header>

      <div className={grade}>
        {/* Resumo primeiro no celular (status, local, confirmar são o que a
            pessoa procura de cara), à direita e fixo no desktop. */}
        <aside className={`${colunaLateral} lg:order-last`}>
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
                  id="denuncia-reclamacao"
                  estilo="botao"
                />
              )
            }
          />
        </aside>

        <div className={colunaPrincipal}>
          <section className="flex flex-col gap-6">
            <p className="text-lg leading-relaxed whitespace-pre-line text-ink-2">
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
                        className="group relative block aspect-4/3 overflow-hidden rounded-lg border border-line bg-sunken"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- imagem externa (Vercel Blob), sem domínio fixo pra configurar no next/image */}
                        <img
                          src={src}
                          alt=""
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <span className="absolute right-2 bottom-2 flex h-7 w-7 items-center justify-center rounded-md bg-night/70 text-chalk opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
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
                className={`flex flex-col gap-4 ${painelSuave}`}
              >
                <p className="text-sm text-ink-muted">{t("contestarDesc")}</p>
                <Campo id="contestar-texto" rotulo={t("contestarPlaceholder")}>
                  <textarea
                    id="contestar-texto"
                    name="texto"
                    required
                    minLength={20}
                    rows={3}
                    className={campoInput}
                  />
                </Campo>
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

          {reclamacao.respostas.length > 0 && (
            <Secao id="respostas" titulo={t("respostasOficiais")} contador={reclamacao.respostas.length}>
              <div className="flex flex-col gap-4">
                {reclamacao.respostas.map((resposta) => (
                  <RespostaOficial
                    key={resposta.id}
                    orgao={resposta.orgao.nome}
                    texto={resposta.texto}
                    data={resposta.createdAt}
                    novoStatus={resposta.novoStatus}
                    prazoEstimado={resposta.prazoEstimado}
                    locale={locale}
                    rotulos={{
                      respostaOficial: t("respostaOficial"),
                      novoStatus: t("novoStatusRotulo"),
                      prazo: t("prazoRotulo"),
                    }}
                  />
                ))}
              </div>
            </Secao>
          )}

          {linhaDoTempo.length > 1 && (
            <Secao id="linha-do-tempo" titulo={t("linhaDoTempo")}>
              <LinhaDoTempoVisual eventos={linhaDoTempo} locale={locale} />
            </Secao>
          )}

          {podeResponder && (
            <form
              action={responderReclamacao.bind(null, reclamacao.id, protocolo)}
              className={`flex flex-col gap-5 ${cartaoSecao}`}
            >
              <h2 className="text-xl font-extrabold tracking-tight text-ink">
                {t("responderComoOrgao")}
              </h2>
              <Campo id="resposta-texto" rotulo={t("respostaOficial")}>
                <textarea
                  id="resposta-texto"
                  name="texto"
                  required
                  minLength={10}
                  rows={4}
                  className={campoInput}
                />
              </Campo>
              <div className="grid gap-5 sm:grid-cols-2">
                <Campo id="resposta-status" rotulo={t("statusRotulo")}>
                  <select id="resposta-status" name="novoStatus" defaultValue="" className={campoInput}>
                    <option value="">{t("manterStatus")}</option>
                    <option value="EM_ANDAMENTO">{t("marcarEmAndamento")}</option>
                    <option value="RESOLVIDA">{t("marcarResolvida")}</option>
                  </select>
                </Campo>
                <Campo id="resposta-prazo" rotulo={t("prazoRotulo")} opcional={t("opcional")}>
                  <input id="resposta-prazo" type="date" name="prazoEstimado" className={campoInput} />
                </Campo>
              </div>
              <button type="submit" className={`${botaoPrimario} w-fit`}>
                {t("enviarResposta")}
              </button>
            </form>
          )}

          {podeAvaliar && (
            <form
              action={avaliarReclamacao.bind(null, reclamacao.id, protocolo)}
              aria-labelledby="avaliacao-titulo"
              className={`flex flex-col gap-5 ${cartaoSecao}`}
            >
              <h2 id="avaliacao-titulo" className="text-xl font-extrabold tracking-tight text-ink">
                {t("foiRealmenteResolvido")}
              </h2>
              {/* O nome do grupo é o próprio título acima: um <legend> repetiria a
                  pergunta (duas vezes no texto da página). */}
              <fieldset aria-labelledby="avaliacao-titulo" className="flex flex-col gap-2.5">
                <label className="flex items-center gap-2.5 text-ink-2">
                  <input type="radio" name="resolvido" value="true" required className="h-4 w-4 accent-brand" />
                  {t("simFoiResolvido")}
                </label>
                <label className="flex items-center gap-2.5 text-ink-2">
                  <input type="radio" name="resolvido" value="false" required className="h-4 w-4 accent-brand" />
                  {t("naoFoiResolvido")}
                </label>
              </fieldset>
              <Campo id="avaliacao-nota" rotulo={t("notaUmACinco")}>
                <select id="avaliacao-nota" name="nota" required defaultValue="" className={`${campoInput} sm:w-40`}>
                  <option value="" disabled>
                    —
                  </option>
                  {[1, 2, 3, 4, 5].map((nota) => (
                    <option key={nota} value={nota}>
                      {nota}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo id="avaliacao-comentario" rotulo={t("comentarioOpcional")}>
                <textarea id="avaliacao-comentario" name="comentario" rows={2} className={campoInput} />
              </Campo>
              <button type="submit" className={`${botaoPrimario} w-fit`}>
                {t("enviarAvaliacao")}
              </button>
            </form>
          )}

          <Secao id="comentarios" titulo={t("comentarios")} contador={comentarios.length}>
            {session?.user ? (
              <form
                action={criarComentario.bind(null, reclamacao.id, protocolo)}
                className="flex flex-col gap-3"
              >
                <Campo id="comentario-novo" rotulo={t("deixeComentario")}>
                  <textarea
                    id="comentario-novo"
                    name="texto"
                    required
                    minLength={3}
                    maxLength={1000}
                    rows={3}
                    className={campoInput}
                  />
                </Campo>
                <button type="submit" className={`${botaoPrimario} w-fit`}>
                  {t("comentar")}
                </button>
              </form>
            ) : (
              <p className={`text-sm ${painelSuave}`}>
                <Link
                  href={`/login?callbackUrl=${encodeURIComponent(`/reclamacoes/${protocolo}`)}`}
                  className="font-semibold text-brand hover:underline"
                >
                  {t("entreParaComentar")}
                </Link>
              </p>
            )}

            {comentarios.length === 0 && (
              <p className="flex items-center gap-2 text-sm text-ink-muted">
                <MessageSquare className="h-4 w-4 shrink-0" aria-hidden />
                {t("nenhumComentario")}
              </p>
            )}

            {comentarios.length > 0 && (
              <div className="flex flex-col divide-y divide-line">
                {comentarios.map((comentario) => {
                  const nomeAutor = comentario.autor.name ?? comentario.autor.email;
                  return (
                    <article key={comentario.id} className="flex gap-3.5 py-6 first:pt-0 last:pb-0">
                      <AvatarIniciais nome={nomeAutor} />
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <p className="text-sm font-semibold text-ink">
                          {nomeAutor}
                          <time
                            dateTime={comentario.createdAt.toISOString()}
                            title={formatarDataHora(comentario.createdAt, locale)}
                            className="ml-2 font-normal text-ink-muted"
                          >
                            {formatarTempoRelativo(comentario.createdAt, locale)}
                          </time>
                        </p>
                        <p className="leading-relaxed text-ink-2">{comentario.texto}</p>

                        {session?.user && (
                          <div className="flex flex-wrap items-start gap-x-5 gap-y-2">
                            <details className="w-fit open:w-full open:max-w-sm">
                              <summary className="inline-flex w-fit cursor-pointer list-none items-center text-xs font-semibold text-brand hover:underline">
                                {t("responder")}
                              </summary>
                              <form
                                action={criarComentario.bind(null, reclamacao.id, protocolo)}
                                className="animate-fade-in mt-3 flex flex-col gap-3"
                              >
                                <input type="hidden" name="paiId" value={comentario.id} />
                                <Campo id={`resposta-${comentario.id}`} rotulo={t("escrevaResposta")}>
                                  <textarea
                                    id={`resposta-${comentario.id}`}
                                    name="texto"
                                    required
                                    minLength={3}
                                    maxLength={1000}
                                    rows={2}
                                    className={campoInput}
                                  />
                                </Campo>
                                <button type="submit" className={`${botaoSecundario} w-fit`}>
                                  {t("responder")}
                                </button>
                              </form>
                            </details>

                            {comentario.autor.id !== session.user.id && (
                              <FormularioDenuncia
                                action={criarDenunciaComentario.bind(null, comentario.id, protocolo)}
                                id={`denuncia-${comentario.id}`}
                              />
                            )}
                          </div>
                        )}

                        {comentario.respostas.length > 0 && (
                          <div className="mt-1 flex flex-col gap-4 border-l-2 border-line pl-4">
                            {comentario.respostas.map((resposta) => (
                              <div key={resposta.id} className="flex flex-col gap-1.5">
                                <p className="text-sm font-semibold text-ink">
                                  {resposta.autor.name ?? resposta.autor.email}
                                  <time
                                    dateTime={resposta.createdAt.toISOString()}
                                    title={formatarDataHora(resposta.createdAt, locale)}
                                    className="ml-2 font-normal text-ink-muted"
                                  >
                                    {formatarTempoRelativo(resposta.createdAt, locale)}
                                  </time>
                                </p>
                                <p className="leading-relaxed text-ink-2">{resposta.texto}</p>
                                {session?.user && resposta.autor.id !== session.user.id && (
                                  <FormularioDenuncia
                                    action={criarDenunciaComentario.bind(null, resposta.id, protocolo)}
                                    id={`denuncia-${resposta.id}`}
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
          </Secao>
        </div>
      </div>
    </main>
  );
}
