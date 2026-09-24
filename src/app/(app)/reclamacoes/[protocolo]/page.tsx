import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/status-badge";
import { botaoPrimario, botaoSecundario, campoInput, cartao, containerPagina } from "@/lib/estilos";
import { orgaoAtendeCategoria } from "@/lib/orgaoCategoria";

import {
  alternarConfirmacao,
  avaliarReclamacao,
  contestarRejeicao,
  criarDenuncia,
  responderReclamacao,
} from "./actions";
import { criarComentario } from "./comentarios";
import { construirLinhaDoTempo } from "./linha-do-tempo";

const MOTIVOS_DENUNCIA = [
  "OFENSIVO",
  "SPAM",
  "DESINFORMACAO",
  "FORA_DE_ESCOPO",
  "DADOS_PESSOAIS",
  "DUPLICADA",
  "OUTRO",
] as const;

export default async function ReclamacaoPage({
  params,
  searchParams,
}: PageProps<"/reclamacoes/[protocolo]">) {
  const t = await getTranslations("ReclamacaoDetalhe");
  const tMotivo = await getTranslations("MotivoDenuncia");
  const locale = await getLocale();
  const { protocolo } = await params;
  const { erro } = await searchParams;

  const reclamacao = await prisma.reclamacao.findUnique({
    where: { protocolo },
    include: {
      categoria: true,
      cidade: true,
      _count: { select: { confirmacoes: true } },
      respostas: { include: { orgao: true }, orderBy: { createdAt: "asc" } },
      avaliacao: true,
      midias: { orderBy: { ordem: "asc" } },
    },
  });

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

  const jaConfirmou =
    !!session?.user &&
    (await prisma.confirmacao.findUnique({
      where: {
        userId_reclamacaoId: {
          userId: session.user.id,
          reclamacaoId: reclamacao.id,
        },
      },
    })) !== null;

  const orgaoDoUsuario =
    session?.user?.papel === "ORGAO" && session.user.orgaoId
      ? await prisma.orgao.findUnique({
          where: { id: session.user.orgaoId },
          include: { categorias: { select: { id: true } } },
        })
      : null;
  const podeResponder =
    !!orgaoDoUsuario?.ativo &&
    orgaoDoUsuario.cidadeId === reclamacao.cidadeId &&
    orgaoAtendeCategoria(orgaoDoUsuario.categorias, reclamacao.categoriaId) &&
    (reclamacao.status === "PUBLICADA" || reclamacao.status === "EM_ANDAMENTO");

  const podeAvaliar =
    ehAutor && reclamacao.status === "RESOLVIDA" && !reclamacao.avaliacao;

  const denunciaAberta =
    !!session?.user &&
    !ehAutor &&
    (await prisma.denuncia.findFirst({
      where: {
        denuncianteId: session.user.id,
        alvoTipo: "RECLAMACAO",
        alvoId: reclamacao.id,
        status: "ABERTA",
      },
    })) !== null;

  const linhaDoTempo = construirLinhaDoTempo(
    reclamacao,
    reclamacao.respostas,
    reclamacao.avaliacao,
    t,
    await getTranslations("Status")
  );

  const comentarios = await prisma.comentario.findMany({
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
  });

  return (
    <main className={containerPagina}>
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {reclamacao.titulo}
        </h1>
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <span>{t("protocolo")} {reclamacao.protocolo}</span>
          <StatusBadge status={reclamacao.status} />
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {reclamacao.categoria.nome} ·{" "}
          <Link href={`/cidades/${reclamacao.cidade.slug}`} className="text-primary underline">
            {reclamacao.cidade.nome}
          </Link>{" "}
          · {reclamacao.endereco}
        </p>
        <p className="text-slate-800 dark:text-slate-200">{reclamacao.descricao}</p>
        {reclamacao.midias.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {reclamacao.midias.map((midia) => (
              // eslint-disable-next-line @next/next/no-img-element -- imagem externa (Vercel Blob), sem domínio fixo pra configurar no next/image
              <img
                key={midia.id}
                src={midia.urlTratada ?? midia.url}
                alt=""
                className="h-40 w-40 rounded-lg border border-slate-200 object-cover dark:border-slate-700"
              />
            ))}
          </div>
        )}
        {reclamacao.status === "REJEITADA" && reclamacao.motivoRejeicao && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {t("motivoRejeicao")} {reclamacao.motivoRejeicao}
          </p>
        )}
        {reclamacao.status === "REJEITADA" && ehAutor && !reclamacao.emRecurso && (
          <form
            action={contestarRejeicao.bind(null, reclamacao.id, protocolo)}
            className="flex flex-col gap-2"
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
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("jaContestou")}</p>
        )}
        {reclamacao.status === "AGUARDANDO_REVISAO" && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            {reclamacao.emRecurso ? t("recursoEmAnalise") : t("encaminhadaRevisao")}
          </p>
        )}
        {erro === "email-nao-verificado" && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            {t("verifiqueEmail")}{" "}
            <Link href="/painel" className="underline">
              {t("seuPainel")}
            </Link>
            .
          </p>
        )}
        {!ehAutor && session?.user && (
          <div className="flex flex-wrap gap-2">
            <form
              action={alternarConfirmacao.bind(null, reclamacao.id, protocolo)}
            >
              <button type="submit" className={`${botaoSecundario} w-fit`}>
                {jaConfirmou ? `✓ ${t("tambemSofro")}` : t("tambemSofro")}
              </button>
            </form>
            {!denunciaAberta && (
              <details className="w-fit">
                <summary
                  className={`${botaoSecundario} inline-flex w-fit cursor-pointer list-none text-red-700 dark:text-red-400`}
                >
                  {t("denunciar")}
                </summary>
                <form
                  action={criarDenuncia.bind(null, reclamacao.id, protocolo)}
                  className={`animate-fade-in mt-2 flex w-72 flex-col gap-2 ${cartao}`}
                >
                  <select name="motivo" required defaultValue="" className={campoInput}>
                    <option value="" disabled>
                      {t("motivo")}
                    </option>
                    {MOTIVOS_DENUNCIA.map((valor) => (
                      <option key={valor} value={valor}>
                        {tMotivo(valor)}
                      </option>
                    ))}
                  </select>
                  <textarea
                    name="descricao"
                    placeholder={t("descricaoOpcional")}
                    rows={2}
                    className={campoInput}
                  />
                  <label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <input
                      type="checkbox"
                      name="declaracaoVeracidade"
                      required
                      className="mt-0.5"
                    />
                    <span>{t("declaracaoBoaFe")}</span>
                  </label>
                  <button type="submit" className={`${botaoPrimario} w-fit`}>
                    {t("enviarDenuncia")}
                  </button>
                </form>
              </details>
            )}
          </div>
        )}
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t("pessoasConfirmaram", { count: reclamacao._count.confirmacoes })}
        </p>
      </div>

      {linhaDoTempo.length > 1 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {t("linhaDoTempo")}
          </h2>
          <ol className="flex flex-col gap-2">
            {linhaDoTempo.map((evento, indice) => (
              <li key={indice} className={cartao}>
                <p className="font-medium text-slate-900 dark:text-slate-100">{evento.titulo}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {evento.data.toLocaleString(locale)}
                </p>
                {evento.descricao && (
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                    {evento.descricao}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>
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

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {t("comentarios")} {comentarios.length > 0 && `(${comentarios.length})`}
        </h2>

        {session?.user && (
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
        )}

        {comentarios.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("nenhumComentario")}</p>
        )}

        {comentarios.map((comentario) => (
          <div key={comentario.id} className={`flex flex-col gap-2 ${cartao}`}>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {comentario.autor.name ?? comentario.autor.email}
              <span className="ml-2 font-normal text-slate-400 dark:text-slate-500">
                {comentario.createdAt.toLocaleString(locale)}
              </span>
            </p>
            <p className="text-sm text-slate-700 dark:text-slate-300">{comentario.texto}</p>

            {session?.user && (
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
            )}

            {comentario.respostas.length > 0 && (
              <div className="ml-4 flex flex-col gap-2 border-l border-slate-200 pl-4 dark:border-slate-700">
                {comentario.respostas.map((resposta) => (
                  <div key={resposta.id}>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {resposta.autor.name ?? resposta.autor.email}
                      <span className="ml-2 font-normal text-slate-400 dark:text-slate-500">
                        {resposta.createdAt.toLocaleString(locale)}
                      </span>
                    </p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{resposta.texto}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
