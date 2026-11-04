import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { CircleCheck, MessageSquareText, SearchX } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/reclamacao/status-badge";
import { Aviso } from "@/components/ui/aviso";
import { Etiqueta, type TomEtiqueta } from "@/components/ui/etiqueta";
import { Paginacao } from "@/components/ui/paginacao";
import { calcularSkip, calcularTotalPaginas, ITENS_POR_PAGINA, lerPaginaAtual } from "@/lib/util/paginacao";
import {
  botaoPrimario,
  botaoSecundario,
  campoInput,
  cartaoSecao,
  colunaLateral,
  colunaPrincipal,
  grade,
  pagina,
  rotuloSecao,
} from "@/lib/estilos";
import { escopoDeReclamacoesDoOrgao, filtroAbertas } from "@/lib/orgaos/escopoOrgao";
import { PRAZO_SEM_RESPOSTA_DIAS } from "@/lib/orgaos/prazoResposta";
import { calcularMetricasOrgao, classificarIndice } from "@/lib/orgaos/reputacaoOrgao";
import { nomeCategoriaTraduzido } from "@/lib/reclamacoes/categoriaI18n";
import { idiomaOuPadrao } from "@/i18n/config";
import { metadataDaPagina } from "@/lib/metadata";
import { diaCalendarioVencido, formatarData, formatarDiaCalendario } from "@/lib/util/formatarData";
import { formatarTempoRelativo } from "@/lib/util/tempo-relativo";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Secao } from "@/components/ui/secao";
import { Campo } from "@/components/formulario/campo";
import { BotaoAcao, FormularioAcao } from "@/components/ui/formulario-acao";

import { responderReclamacao } from "../reclamacoes/[protocolo]/actions";
import { exigirOrgao } from "../reclamacoes/[protocolo]/exigir-orgao";

export const generateMetadata = metadataDaPagina("PainelOrgao");

export default async function PainelOrgaoPage({ searchParams }: PageProps<"/orgao">) {
  const t = await getTranslations("PainelOrgao");
  const tResp = await getTranslations("ReclamacaoDetalhe");
  const tSelo = await getTranslations("Selo");
  const locale = await getLocale();
  const session = await exigirOrgao();

  const { pagePendentes, pageHistorico, fila: filaParam, q, categoria } = await searchParams;
  const paginaPendentes = lerPaginaAtual(pagePendentes);
  const paginaHistorico = lerPaginaAtual(pageHistorico);

  const orgao = await prisma.orgao.findUnique({
    where: { id: session.user.orgaoId! },
    include: { categorias: { select: { id: true, nome: true, slug: true } } },
  });
  const idioma = idiomaOuPadrao(locale);

  // categoriasIds null = orgao sem categoria atribuida, atende qualquer
  // uma da cidade (ver orgaoAtendeCategoria em lib/orgaos/orgaoCategoria.ts).
  const categoriaIds =
    orgao && orgao.categorias.length > 0 ? orgao.categorias.map((c) => c.id) : null;

  // As categorias que o filtro oferece: as do órgão, ou todas as ativas quando ele atende
  // qualquer uma. Um `categoria` da URL fora desta lista é ignorado (link antigo, id forjado).
  const categoriasDoEscopo = orgao
    ? (categoriaIds
        ? orgao.categorias
        : await prisma.categoria.findMany({
            where: { ativa: true },
            orderBy: { ordem: "asc" },
            select: { id: true, nome: true, slug: true },
          }))
    : [];
  const categoriaFiltro =
    typeof categoria === "string" && categoriasDoEscopo.some((c) => c.id === categoria)
      ? categoria
      : null;
  const termo = typeof q === "string" ? q.trim().slice(0, 100) : "";

  // Duas filas, porque pedem ação diferente: "sem resposta" é o que ninguém atendeu ainda;
  // "em acompanhamento" já teve resposta (prazo, andamento) e continua aberta. Misturadas, o
  // contador de "pendentes" inflava com o que o órgão já tinha respondido.
  const fila: "sem-resposta" | "acompanhamento" =
    filaParam === "acompanhamento" ? "acompanhamento" : "sem-resposta";

  // O escopo (cidade, categorias atendidas, autor de fora) é o mesmo que o aviso em tempo real e
  // o resumo semanal usam: ver lib/orgaos/escopoOrgao.ts. Aqui só se somam o filtro de categoria
  // escolhido na tela (que cabe dentro do escopo) e a busca.
  const filtroBase = orgao
    ? {
        ...escopoDeReclamacoesDoOrgao(orgao, categoriaIds),
        ...filtroAbertas,
        ...(categoriaFiltro ? { categoriaId: categoriaFiltro } : {}),
        ...(termo
          ? { OR: [{ protocolo: { contains: termo } }, { titulo: { contains: termo } }] }
          : {}),
      }
    : null;
  const filtroSemResposta = filtroBase && { ...filtroBase, respostas: { none: {} } };
  const filtroAcompanhamento = filtroBase && { ...filtroBase, respostas: { some: {} } };
  const filtroPendentes = fila === "sem-resposta" ? filtroSemResposta : filtroAcompanhamento;

  const [pendentes, totalSemResposta, totalAcompanhamento, metricas, historico, totalHistorico] =
    await Promise.all([
    filtroPendentes
      ? prisma.reclamacao.findMany({
          where: filtroPendentes,
          // Sem resposta: a que espera há mais tempo primeiro. Em acompanhamento: a de
          // resposta mais antiga primeiro (updatedAt é tocado a cada resposta), que é a que
          // o órgão mais corre o risco de ter esquecido.
          orderBy: fila === "sem-resposta" ? { publicadaEm: "asc" } : { updatedAt: "asc" },
          include: {
            categoria: true,
            _count: { select: { confirmacoes: true } },
            // A última resposta oficial (de qualquer órgão): quando foi e que prazo deu.
            respostas: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { createdAt: true, prazoEstimado: true },
            },
          },
          skip: calcularSkip(paginaPendentes),
          take: ITENS_POR_PAGINA,
        })
      : Promise.resolve([]),
    filtroSemResposta ? prisma.reclamacao.count({ where: filtroSemResposta }) : Promise.resolve(0),
    filtroAcompanhamento
      ? prisma.reclamacao.count({ where: filtroAcompanhamento })
      : Promise.resolve(0),
    orgao
      ? calcularMetricasOrgao(orgao.id)
      : Promise.resolve(null),
    orgao
      ? prisma.respostaOficial.findMany({
          where: { orgaoId: orgao.id },
          orderBy: { createdAt: "desc" },
          distinct: ["reclamacaoId"],
          skip: calcularSkip(paginaHistorico),
          take: ITENS_POR_PAGINA,
          include: {
            reclamacao: {
              select: {
                titulo: true,
                protocolo: true,
                status: true,
                avaliacao: { select: { nota: true, resolvido: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
    orgao
      ? prisma.respostaOficial
          .findMany({ where: { orgaoId: orgao.id }, distinct: ["reclamacaoId"], select: { id: true } })
          .then((linhas) => linhas.length)
      : Promise.resolve(0),
  ]);
  const totalFilaAtual = fila === "sem-resposta" ? totalSemResposta : totalAcompanhamento;
  const totalPaginasPendentes = calcularTotalPaginas(totalFilaAtual);
  const totalPaginasHistorico = calcularTotalPaginas(totalHistorico);
  const filtrando = termo !== "" || categoriaFiltro !== null;

  // Link do painel com os filtros de agora (fila, busca, categoria) e, opcionalmente, outra fila.
  const hrefPainel = (filaDestino: typeof fila) => {
    const params = new URLSearchParams();
    if (filaDestino !== "sem-resposta") params.set("fila", filaDestino);
    if (termo) params.set("q", termo);
    if (categoriaFiltro) params.set("categoria", categoriaFiltro);
    const query = params.toString();
    return query ? `/orgao?${query}` : "/orgao";
  };
  const filas = [
    { chave: "sem-resposta" as const, rotulo: t("filaSemResposta"), total: totalSemResposta },
    { chave: "acompanhamento" as const, rotulo: t("filaAcompanhamento"), total: totalAcompanhamento },
  ];

  const classificacao = metricas
    ? classificarIndice(metricas.indiceResolucao, metricas.baseDoIndice)
    : null;

  const agora = new Date();
  const DIA_MS = 86_400_000;
  // Quanto uma reclamação SEM resposta já esperou: neutro na primeira semana, âmbar
  // até a segunda, vermelho depois - o órgão vê de relance o que está vencendo.
  const tomDaEspera = (desde: Date): TomEtiqueta => {
    const dias = (agora.getTime() - desde.getTime()) / DIA_MS;
    return dias >= 15 ? "erro" : dias >= 7 ? "atencao" : "neutro";
  };

  return (
    <main className={pagina}>
      <CabecalhoPagina
        kicker={t("kicker")}
        titulo={orgao ? orgao.nome : t("titulo")}
        descricao={
          orgao &&
          (categoriaIds
            ? t("atende", { categorias: orgao.categorias.map((c) => c.nome).join(", ") })
            : t("atendeTodas"))
        }
      />

      {/* O órgão desativado continua vendo a fila (é o que está parado por causa disso), mas
          não responde: sem este aviso o formulário sumia e a tela parecia quebrada. */}
      {orgao && !orgao.ativo && <Aviso tom="atencao">{t("orgaoDesativado")}</Aviso>}

      <div className={grade}>
        <div className={colunaPrincipal}>
          <Secao
            id="pendentes"
            titulo={t("aAtender")}
            contador={totalSemResposta + totalAcompanhamento}
          >
            <div className="flex flex-col gap-4">
              <nav aria-label={t("filasRotulo")} className="flex flex-wrap items-center gap-3">
                <div className="flex gap-1 rounded-md bg-sunken p-1">
                  {filas.map((item) => (
                    <Link
                      key={item.chave}
                      href={hrefPainel(item.chave)}
                      aria-current={fila === item.chave ? "true" : undefined}
                      className={
                        fila === item.chave
                          ? "rounded-[5px] bg-surface px-3 py-1.5 text-sm font-semibold text-ink shadow-[0_1px_2px_rgb(14_21_32/0.12)]"
                          : "rounded-[5px] px-3 py-1.5 text-sm font-medium text-ink-muted hover:text-ink"
                      }
                    >
                      {item.rotulo}
                      <span className="ml-2 font-mono text-xs tabular-nums">{item.total}</span>
                    </Link>
                  ))}
                </div>
                <p className="text-xs text-ink-muted">
                  {fila === "sem-resposta" ? t("filaSemRespostaDesc") : t("filaAcompanhamentoDesc")}
                </p>
              </nav>

              <form
                method="get"
                action="/orgao"
                role="search"
                aria-label={t("buscarRotulo")}
                className="flex flex-wrap items-end gap-3"
              >
                {fila !== "sem-resposta" && <input type="hidden" name="fila" value={fila} />}
                <div className="flex min-w-48 flex-1 flex-col gap-1.5">
                  <label htmlFor="painel-busca" className={rotuloSecao}>
                    {t("buscarRotulo")}
                  </label>
                  <input
                    id="painel-busca"
                    type="search"
                    name="q"
                    defaultValue={termo}
                    maxLength={100}
                    className={campoInput}
                  />
                </div>
                {categoriasDoEscopo.length > 1 && (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="painel-categoria" className={rotuloSecao}>
                      {t("categoriaRotulo")}
                    </label>
                    <select
                      id="painel-categoria"
                      name="categoria"
                      defaultValue={categoriaFiltro ?? ""}
                      className={campoInput}
                    >
                      <option value="">{t("todasCategorias")}</option>
                      {categoriasDoEscopo.map((c) => (
                        <option key={c.id} value={c.id}>
                          {nomeCategoriaTraduzido(c.slug, c.nome, idioma)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <button type="submit" className={botaoSecundario}>
                  {t("buscar")}
                </button>
                {filtrando && (
                  <Link
                    href={fila === "sem-resposta" ? "/orgao" : `/orgao?fila=${fila}`}
                    className="py-2.5 text-sm font-medium text-brand underline underline-offset-2"
                  >
                    {t("limparFiltros")}
                  </Link>
                )}
              </form>
            </div>

            {pendentes.length === 0 && (
              <EstadoVazio
                icone={filtrando ? SearchX : CircleCheck}
                titulo={
                  filtrando
                    ? t("nenhumaComFiltros")
                    : fila === "sem-resposta"
                      ? t("nenhumaSemResposta")
                      : t("nenhumaAcompanhamento")
                }
              />
            )}

            {pendentes.map((reclamacao) => {
              const publicadaEm = reclamacao.publicadaEm ?? reclamacao.createdAt;
              const ultimaResposta = reclamacao.respostas[0];
              const prazo = ultimaResposta?.prazoEstimado;

              return (
                <article key={reclamacao.id} className={`flex flex-col gap-4 ${cartaoSecao}`}>
                  <header className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={reclamacao.status} />
                      {ultimaResposta ? (
                        <Etiqueta tom="apagado">
                          {t("ultimaResposta", {
                            tempo: formatarTempoRelativo(ultimaResposta.createdAt, locale),
                          })}
                        </Etiqueta>
                      ) : (
                        <Etiqueta tom={tomDaEspera(publicadaEm)}>
                          {t("semResposta", { tempo: formatarTempoRelativo(publicadaEm, locale) })}
                        </Etiqueta>
                      )}
                      {/* O prazo é um dia de calendário: vence no FIM dele, e aparece com o dia
                          que o órgão escolheu (ver lib/util/formatarData). */}
                      {prazo && (
                        <Etiqueta tom={diaCalendarioVencido(prazo, agora) ? "erro" : "neutro"}>
                          {diaCalendarioVencido(prazo, agora)
                            ? t("prazoVencido", { data: formatarDiaCalendario(prazo, locale) })
                            : t("prazo", { data: formatarDiaCalendario(prazo, locale) })}
                        </Etiqueta>
                      )}
                    </div>
                    <p className="kicker">
                      {reclamacao.protocolo} ·{" "}
                      {nomeCategoriaTraduzido(reclamacao.categoria.slug, reclamacao.categoria.nome, idioma)}
                    </p>
                    <h3 className="text-lg leading-snug font-extrabold tracking-tight text-ink">
                      <Link href={`/reclamacoes/${reclamacao.protocolo}`} className="hover:text-brand">
                        {reclamacao.titulo}
                      </Link>
                    </h3>
                    <p className="text-sm text-ink-muted">
                      {reclamacao.endereco} · {t("confirmacoes", { count: reclamacao._count.confirmacoes })}
                    </p>
                  </header>
                  <p className="line-clamp-3 leading-relaxed text-ink-2">{reclamacao.descricao}</p>

                  {/* O formulário fica recolhido: sete reclamações com sete formulários abertos
                      faziam do painel uma página de rolagem sem fim. */}
                  {orgao?.ativo && (
                  <details className="group border-t border-line pt-4">
                    <summary className={`${botaoPrimario} w-fit cursor-pointer list-none`}>
                      {t("responder")}
                    </summary>
                    <FormularioAcao
                      action={responderReclamacao.bind(null, reclamacao.id, reclamacao.protocolo)}
                      limparAoSucesso
                      recolherAoSucesso
                      className="animate-fade-in mt-4 flex flex-col gap-4"
                    >
                      <Campo id={`resposta-${reclamacao.id}`} rotulo={tResp("respostaOficial")}>
                        <textarea
                          id={`resposta-${reclamacao.id}`}
                          name="texto"
                          required
                          minLength={10}
                          rows={3}
                          className={campoInput}
                        />
                      </Campo>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Campo id={`status-${reclamacao.id}`} rotulo={tResp("statusRotulo")}>
                          <select
                            id={`status-${reclamacao.id}`}
                            name="novoStatus"
                            defaultValue=""
                            className={campoInput}
                          >
                            <option value="">{tResp("manterStatus")}</option>
                            <option value="EM_ANDAMENTO">{tResp("marcarEmAndamento")}</option>
                            <option value="RESOLVIDA">{tResp("marcarResolvida")}</option>
                          </select>
                        </Campo>
                        <Campo
                          id={`prazo-${reclamacao.id}`}
                          rotulo={tResp("prazoRotulo")}
                          opcional={tResp("opcional")}
                        >
                          <input
                            id={`prazo-${reclamacao.id}`}
                            type="date"
                            name="prazoEstimado"
                            className={campoInput}
                          />
                        </Campo>
                      </div>
                      <BotaoAcao className={`${botaoPrimario} w-fit`}>{tResp("enviarResposta")}</BotaoAcao>
                    </FormularioAcao>
                  </details>
                  )}
                </article>
              );
            })}

            <Paginacao
              paginaAtual={paginaPendentes}
              totalPaginas={totalPaginasPendentes}
              basePath="/orgao"
              paramName="pagePendentes"
              searchParams={{
                fila: fila === "sem-resposta" ? undefined : fila,
                q: termo || undefined,
                categoria: categoriaFiltro ?? undefined,
                pageHistorico: typeof pageHistorico === "string" ? pageHistorico : undefined,
              }}
            />
          </Secao>

          <Secao id="historico" titulo={t("historicoRespostas")} contador={totalHistorico}>
            {historico.length === 0 && (
              <EstadoVazio icone={MessageSquareText} titulo={t("nenhumaRespondida")} />
            )}

            {historico.length > 0 && (
              <ul className="-mt-2 divide-y divide-line">
                {historico.map((resposta) => (
                  <li key={resposta.id}>
                    <Link
                      href={`/reclamacoes/${resposta.reclamacao.protocolo}`}
                      className="group flex flex-col gap-2 py-5 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <p className="font-bold text-ink group-hover:text-brand">
                          {resposta.reclamacao.titulo}
                        </p>
                        <StatusBadge status={resposta.reclamacao.status} />
                      </div>
                      <p className="line-clamp-3 leading-relaxed text-ink-2">{resposta.texto}</p>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="kicker">
                          {resposta.reclamacao.protocolo} ·{" "}
                          {formatarData(resposta.createdAt, locale)}
                        </p>
                        {resposta.reclamacao.avaliacao ? (
                          <p
                            className={`text-xs font-semibold ${
                              resposta.reclamacao.avaliacao.resolvido
                                ? "text-ok-ink"
                                : "text-danger-ink"
                            }`}
                          >
                            {resposta.reclamacao.avaliacao.resolvido
                              ? `✓ ${t("cidadaoConfirmou")}`
                              : `✗ ${t("cidadaoDizNaoResolvido")}`}{" "}
                            ({resposta.reclamacao.avaliacao.nota}/5)
                          </p>
                        ) : (
                          <p className="text-xs text-ink-muted">{t("aguardandoAvaliacao")}</p>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <Paginacao
              paginaAtual={paginaHistorico}
              totalPaginas={totalPaginasHistorico}
              basePath="/orgao"
              paramName="pageHistorico"
              searchParams={{
                fila: fila === "sem-resposta" ? undefined : fila,
                q: termo || undefined,
                categoria: categoriaFiltro ?? undefined,
                pagePendentes: typeof pagePendentes === "string" ? pagePendentes : undefined,
              }}
            />
          </Secao>
        </div>

        <aside className={colunaLateral}>
          {orgao && metricas && classificacao && (
            <section className={`flex flex-col gap-5 ${cartaoSecao}`}>
              <div className="flex flex-col gap-2">
                <span className="kicker">{t("suaReputacao")}</span>
                <span
                  className={`inline-block w-fit rounded-[5px] px-2.5 py-1 text-sm font-semibold ${classificacao.className}`}
                >
                  {tSelo(classificacao.chave)}
                </span>
              </div>

              <dl className="flex flex-col divide-y divide-line">
                {[
                  {
                    rotulo: t("resolvidas"),
                    valor: metricas.indiceResolucao !== null ? `${metricas.indiceResolucao}%` : "—",
                  },
                  {
                    rotulo: t("tempoMedioResposta"),
                    valor:
                      metricas.tempoMedioRespostaDias !== null
                        ? `${metricas.tempoMedioRespostaDias}d`
                        : "—",
                  },
                  {
                    rotulo: t("notaCidadaos"),
                    valor: metricas.notaMedia !== null ? `${metricas.notaMedia}/5` : "—",
                  },
                  { rotulo: t("avaliacoesRecebidas"), valor: String(metricas.totalAvaliacoes) },
                  {
                    rotulo: t("semRespostaVencidas", { dias: PRAZO_SEM_RESPOSTA_DIAS }),
                    valor: String(metricas.semRespostaVencidas),
                  },
                ].map((item) => (
                  <div key={item.rotulo} className="flex items-baseline justify-between gap-4 py-3">
                    <dt className="text-sm text-ink-muted">{item.rotulo}</dt>
                    <dd className="font-mono text-xl font-medium text-ink tabular-nums">{item.valor}</dd>
                  </div>
                ))}
              </dl>

              <p className="text-sm text-ink-muted">
                {t("reputacaoNota", { dias: PRAZO_SEM_RESPOSTA_DIAS })}
              </p>

              <Link
                href={`/orgaos/${orgao.id}`}
                className="text-sm font-semibold text-brand underline underline-offset-2"
              >
                {t("verComoOsCidadaosVeem")}
              </Link>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
