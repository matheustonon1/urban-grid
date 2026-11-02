import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BrainCircuit,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { CategoriaIcon } from "@/components/reclamacao/categoria-icon";
import { StatusBadge } from "@/components/reclamacao/status-badge";
import { Revelar } from "@/components/ui/revelar";
import { prisma } from "@/lib/prisma";
import { botaoPrimario, botaoSecundario, containerSite } from "@/lib/estilos";
import { calcularMetricasOrgao, classificarIndice } from "@/lib/orgaos/reputacaoOrgao";
import { STATUS_PUBLICOS } from "@/lib/reclamacoes/statusPublicos";

// Etapas da vida pública de uma reclamação, na ordem em que a ficha as mostra.
const ETAPAS_FICHA = ["PUBLICADA", "EM_ANDAMENTO", "RESOLVIDA"] as const;

export default async function Home() {
  const session = await auth();
  const logado = Boolean(session?.user);

  const t = await getTranslations("Home");
  const tSelo = await getTranslations("Selo");
  const tStatus = await getTranslations("Status");

  const PASSOS = [
    { titulo: t("passo1Titulo"), descricao: t("passo1Desc") },
    { titulo: t("passo2Titulo"), descricao: t("passo2Desc") },
    { titulo: t("passo3Titulo"), descricao: t("passo3Desc") },
    { titulo: t("passo4Titulo"), descricao: t("passo4Desc") },
  ];

  const DIFERENCIAIS = [
    { icone: BrainCircuit, titulo: t("diferencial1Titulo"), descricao: t("diferencial1Desc") },
    { icone: Award, titulo: t("diferencial2Titulo"), descricao: t("diferencial2Desc") },
    { icone: MessageSquare, titulo: t("diferencial3Titulo"), descricao: t("diferencial3Desc") },
    { icone: ShieldCheck, titulo: t("diferencial4Titulo"), descricao: t("diferencial4Desc") },
  ];

  const [
    totalReclamacoes,
    totalResolvidas,
    totalCidades,
    totalOrgaos,
    reclamacoesRecentes,
    candidatosResposta,
  ] = await Promise.all([
    prisma.reclamacao.count({ where: { status: { in: [...STATUS_PUBLICOS] } } }),
    prisma.reclamacao.count({ where: { status: "RESOLVIDA" } }),
    prisma.cidade.count({
      where: { reclamacoes: { some: { status: { in: [...STATUS_PUBLICOS] } } } },
    }),
    prisma.orgao.count({ where: { ativo: true } }),
    // 4: a mais nova vira a "ficha" do topo, as 3 seguintes entram na lista.
    prisma.reclamacao.findMany({
      where: { status: { in: [...STATUS_PUBLICOS] } },
      orderBy: { createdAt: "desc" },
      take: 4,
      include: {
        categoria: true,
        cidade: { include: { estado: true } },
        _count: { select: { confirmacoes: true } },
      },
    }),
    prisma.respostaOficial.groupBy({
      by: ["orgaoId"],
      _count: { orgaoId: true },
      orderBy: { _count: { orgaoId: "desc" } },
      take: 6,
    }),
  ]);

  const [destaque, ...outrasRecentes] = reclamacoesRecentes;

  const orgaosCandidatos = await prisma.orgao.findMany({
    where: { id: { in: candidatosResposta.map((c) => c.orgaoId) }, ativo: true },
    include: { cidade: true },
  });

  const rankingOrgaos = (
    await Promise.all(
      orgaosCandidatos.map(async (orgao) => ({
        orgao,
        metricas: await calcularMetricasOrgao(orgao.id),
      }))
    )
  )
    .filter(({ metricas }) => metricas.indiceResolucao !== null)
    .sort((a, b) => (b.metricas.indiceResolucao ?? 0) - (a.metricas.indiceResolucao ?? 0))
    .slice(0, 3);

  const indiceResolucao =
    totalReclamacoes > 0 ? Math.round((totalResolvidas / totalReclamacoes) * 100) : null;

  const ESTATISTICAS = [
    { valor: totalReclamacoes, rotulo: t("statReclamacoes") },
    { valor: totalCidades, rotulo: t("statCidades") },
    { valor: totalOrgaos, rotulo: t("statOrgaos") },
    {
      valor: indiceResolucao !== null ? `${indiceResolucao}%` : "—",
      rotulo: t("statIndice"),
    },
  ];

  const etapaAtual = destaque
    ? Math.max(0, ETAPAS_FICHA.indexOf(destaque.status as (typeof ETAPAS_FICHA)[number]))
    : 0;

  return (
    <main className="flex flex-1 flex-col">
      {/* ---------------------------------------------------------------- topo */}
      <section className="relative overflow-hidden border-b border-line">
        <div aria-hidden className="bg-planta pointer-events-none absolute inset-0 -z-10" />

        <div
          className={`${containerSite} grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-12 lg:gap-10`}
        >
          <div className="animate-fade-in flex flex-col items-start gap-6 lg:col-span-7">
            <span className="kicker inline-flex items-center gap-2">
              <span aria-hidden className="h-2 w-2 rounded-xs bg-signal" />
              {t("badge")}
            </span>

            <h1 className="max-w-2xl text-4xl leading-[1.05] font-extrabold tracking-tight text-ink sm:text-6xl">
              {t.rich("titulo", {
                marca: (trecho) => <span className="marca-texto">{trecho}</span>,
              })}
            </h1>

            <p className="max-w-xl text-lg leading-relaxed text-ink-muted">{t("subtitulo")}</p>

            <div className="flex flex-wrap items-center gap-3">
              <Link href="/reclamacoes" className={`${botaoPrimario} group px-5 py-3 text-base`}>
                {t("verReclamacoes")}
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-1"
                  aria-hidden
                />
              </Link>
              {logado ? (
                <Link href="/painel" className={`${botaoSecundario} px-5 py-3 text-base`}>
                  {t("irParaPainel")}
                </Link>
              ) : (
                <Link href="/cadastro" className={`${botaoSecundario} px-5 py-3 text-base`}>
                  {t("criarConta")}
                </Link>
              )}
            </div>

            {!logado && (
              <Link
                href="/login"
                className="text-sm font-medium text-brand underline underline-offset-4"
              >
                {t("jaTemConta")}
              </Link>
            )}
          </div>

          {destaque && (
            // A "ficha": a reclamação mais recente de verdade, com o que o
            // site promete mostrar de cada uma - protocolo, onde fica, em que
            // etapa está e quem também confirmou. Não é ilustração genérica.
            <Link
              href={`/reclamacoes/${destaque.protocolo}`}
              className="group animate-fade-in block overflow-hidden rounded-xl border border-line-strong bg-surface shadow-[0_24px_48px_-28px_rgb(14_21_32/0.45)] transition-transform hover:-translate-y-0.5 lg:col-span-5"
            >
              <MapaFicha />
              <div className="flex flex-col gap-4 p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="kicker truncate">{destaque.protocolo}</span>
                  <StatusBadge status={destaque.status} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <h2 className="text-xl leading-snug font-bold text-ink">{destaque.titulo}</h2>
                  <p className="flex items-center gap-1.5 text-sm text-ink-muted">
                    <CategoriaIcon
                      icone={destaque.categoria.icone}
                      className="h-3.5 w-3.5 shrink-0"
                    />
                    {destaque.categoria.nome} · {destaque.cidade.nome} - {destaque.cidade.estado.uf}
                  </p>
                </div>

                <ol className="grid grid-cols-3 gap-2" aria-label={t("etapas")}>
                  {ETAPAS_FICHA.map((etapa, indice) => (
                    <li
                      key={etapa}
                      className="flex flex-col gap-1.5"
                      aria-current={indice === etapaAtual ? "step" : undefined}
                    >
                      <span
                        aria-hidden
                        className={`h-1 rounded-full ${indice <= etapaAtual ? "bg-brand" : "bg-line"}`}
                      />
                      <span
                        className={`text-xs ${
                          indice === etapaAtual ? "font-semibold text-ink" : "text-ink-muted"
                        }`}
                      >
                        {tStatus(etapa)}
                      </span>
                    </li>
                  ))}
                </ol>

                <p className="flex items-center justify-between gap-3 border-t border-line pt-3 text-sm">
                  <span className="text-ink-muted">
                    {t("confirmacoes", { count: destaque._count.confirmacoes })}
                  </span>
                  <span className="flex items-center gap-1 font-medium text-brand">
                    {t("abrirFicha")}
                    <ArrowUpRight
                      className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      aria-hidden
                    />
                  </span>
                </p>
              </div>
            </Link>
          )}
        </div>
      </section>

      {/* -------------------------------------------------------------- números */}
      {totalReclamacoes > 0 && (
        <section aria-label={t("numeros")} className="border-b border-line bg-surface">
          <dl className={`${containerSite} grid grid-cols-2 gap-y-6 py-8 lg:grid-cols-4`}>
            {ESTATISTICAS.map((item, indice) => (
              <div
                key={item.rotulo}
                className={`flex flex-col-reverse gap-1 ${
                  indice % 2 === 1 ? "border-l border-line pl-6" : ""
                } ${indice > 0 ? "lg:border-l lg:border-line lg:pl-8" : ""}`}
              >
                <dt className="kicker">{item.rotulo}</dt>
                <dd className="font-mono text-4xl font-medium tracking-tight text-ink tabular-nums">
                  {item.valor}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* --------------------------------------------------------- como funciona */}
      <section className={`${containerSite} flex flex-col gap-10 py-16 sm:py-20`}>
        <Revelar className="flex max-w-xl flex-col gap-2">
          <h2 className="text-3xl font-extrabold tracking-tight text-ink">{t("comoFunciona")}</h2>
          <p className="text-ink-muted">{t("comoFuncionaSub")}</p>
        </Revelar>

        <Revelar atraso={120}>
          <ol className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {PASSOS.map((passo, indice) => (
              // Régua com o número no começo: é um passo a passo de verdade (a
              // ordem importa e os passos não são clicáveis), então ganha uma
              // sequência numerada, não cartões.
              <li key={passo.titulo} className="flex flex-col gap-3">
                <div className="flex items-center gap-3" aria-hidden>
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-ink font-mono text-sm font-medium text-paper">
                    {String(indice + 1).padStart(2, "0")}
                  </span>
                  <span className="h-px flex-1 bg-line-strong" />
                </div>
                <h3 className="text-lg font-bold text-ink">{passo.titulo}</h3>
                <p className="text-sm leading-relaxed text-ink-muted">{passo.descricao}</p>
              </li>
            ))}
          </ol>
        </Revelar>
      </section>

      {/* ----------------------------------------------------- acontecendo agora */}
      {outrasRecentes.length > 0 && (
        <section className="border-y border-line bg-surface">
          <div className={`${containerSite} flex flex-col gap-8 py-16`}>
            <Revelar className="flex flex-col gap-2">
              <span className="kicker flex items-center gap-2">
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-75 motion-reduce:hidden" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-signal" />
                </span>
                {t("aoVivo")}
              </span>
              <h2 className="text-3xl font-extrabold tracking-tight text-ink">
                {t("acontecendoAgora")}
              </h2>
              <p className="max-w-xl text-ink-muted">{t("acontecendoAgoraSub")}</p>
            </Revelar>

            <Revelar atraso={120}>
              <ul className="divide-y divide-line border-y border-line">
                {outrasRecentes.map((reclamacao) => (
                  <li key={reclamacao.id}>
                    <Link
                      href={`/reclamacoes/${reclamacao.protocolo}`}
                      className="group grid items-center gap-x-6 gap-y-1.5 py-4 transition-colors hover:bg-sunken/60 sm:grid-cols-[11rem_1fr_auto] sm:px-2"
                    >
                      <span className="kicker truncate">{reclamacao.protocolo}</span>
                      <span className="min-w-0">
                        <span className="block truncate font-bold text-ink group-hover:text-brand">
                          {reclamacao.titulo}
                        </span>
                        <span className="block truncate text-sm text-ink-muted">
                          {reclamacao.categoria.nome} · {reclamacao.cidade.nome} -{" "}
                          {reclamacao.cidade.estado.uf} ·{" "}
                          {t("confirmacoes", { count: reclamacao._count.confirmacoes })}
                        </span>
                      </span>
                      <span className="justify-self-start sm:justify-self-end">
                        <StatusBadge status={reclamacao.status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Revelar>

            <Link
              href="/reclamacoes"
              className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-brand underline underline-offset-4"
            >
              {t("verTodasReclamacoes")}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------ diferenciais */}
      <section className={`${containerSite} grid gap-10 py-16 sm:py-20 lg:grid-cols-12`}>
        <Revelar className="flex flex-col gap-2 lg:col-span-4">
          <h2 className="text-3xl font-extrabold tracking-tight text-ink">{t("diferente")}</h2>
          <p className="text-ink-muted">{t("diferenteSub")}</p>
        </Revelar>

        <Revelar atraso={120} className="min-w-0 lg:col-span-8">
          <ul className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {DIFERENCIAIS.map((item) => (
              <li key={item.titulo} className="flex flex-col gap-2 border-t-2 border-ink pt-4">
                <item.icone className="h-5 w-5 text-brand" aria-hidden />
                <h3 className="text-lg font-bold text-ink">{item.titulo}</h3>
                <p className="text-sm leading-relaxed text-ink-muted">{item.descricao}</p>
              </li>
            ))}
          </ul>
        </Revelar>
      </section>

      {/* ---------------------------------------------------------------- ranking */}
      {rankingOrgaos.length > 0 && (
        <section className="border-y border-line bg-surface">
          <div className={`${containerSite} grid gap-10 py-16 lg:grid-cols-12`}>
            <Revelar className="flex flex-col gap-2 lg:col-span-4">
              <h2 className="text-3xl font-extrabold tracking-tight text-ink">
                {t("melhorAvaliados")}
              </h2>
              <p className="text-ink-muted">{t("melhorAvaliadosSub")}</p>
            </Revelar>

            {/* min-w-0: filho de grid não encolhe abaixo do conteúdo; sem isto o nome longo de
                um órgão (truncate = nowrap) alargava a coluna e a página rolava de lado no celular. */}
            <Revelar atraso={120} className="min-w-0 lg:col-span-8">
              <ol className="divide-y divide-line border-y border-line">
                {rankingOrgaos.map(({ orgao, metricas }, indice) => {
                  const classificacao = classificarIndice(
                    metricas.indiceResolucao,
                    metricas.totalRespondidas
                  );
                  return (
                    <li key={orgao.id}>
                      <Link
                        href={`/orgaos/${orgao.id}`}
                        className="group flex items-center gap-4 py-4 transition-colors hover:bg-sunken/60 sm:px-2"
                      >
                        <span className="w-8 shrink-0 font-mono text-2xl font-medium text-ink-faint tabular-nums">
                          {String(indice + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-bold text-ink group-hover:text-brand">
                            {orgao.nome}
                            {orgao.sigla && ` (${orgao.sigla})`}
                          </span>
                          <span className="block truncate text-sm text-ink-muted">
                            {orgao.cidade.nome} ·{" "}
                            {t("reclamacoesRespondidas", { count: metricas.totalRespondidas })}
                          </span>
                        </span>
                        <span
                          className={`shrink-0 rounded-[5px] px-2 py-0.5 text-xs font-semibold ${classificacao.className}`}
                        >
                          {tSelo(classificacao.chave)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </Revelar>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------- participar */}
      {!logado && (
        <section className="bg-night text-chalk">
          <div aria-hidden className="faixa-obra h-2" />
          <div className={`${containerSite} grid gap-10 py-16 lg:grid-cols-12 lg:items-center`}>
            <div className="flex flex-col gap-3 lg:col-span-5">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                {t("prontoParticipar")}
              </h2>
              <p className="text-chalk/75">{t("prontoParticiparSub")}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:col-span-7">
              <div className="flex flex-col items-start gap-3 rounded-lg border border-chalk/20 p-5">
                <p className="text-lg font-bold">{t("souCidadao")}</p>
                <p className="flex-1 text-sm leading-relaxed text-chalk/75">
                  {t("souCidadaoDesc")}
                </p>
                <Link
                  href="/cadastro"
                  className="inline-flex items-center justify-center rounded-md bg-signal px-4 py-2.5 text-sm font-semibold text-on-signal transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
                >
                  {t("criarContaGratuita")}
                </Link>
              </div>

              <div className="flex flex-col items-start gap-3 rounded-lg border border-chalk/20 p-5">
                <p className="text-lg font-bold">{t("souOrgao")}</p>
                <p className="flex-1 text-sm leading-relaxed text-chalk/75">{t("souOrgaoDesc")}</p>
                <Link
                  href="/cadastro?tipo=orgao"
                  className="inline-flex items-center justify-center rounded-md border border-chalk/40 px-4 py-2.5 text-sm font-semibold text-chalk transition-colors hover:bg-chalk/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chalk"
                >
                  {t("solicitarAcesso")}
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

// Cabeça da "ficha": quarteirões e ruas desenhados em SVG, com o alfinete de
// obra no meio. Estático e decorativo (aria-hidden) - o que importa está no
// texto logo abaixo.
function MapaFicha() {
  const quarteiroes = [
    [8, 8, 54, 26],
    [78, 8, 94, 26],
    [188, 8, 104, 26],
    [308, 8, 84, 26],
    [8, 50, 54, 44],
    [78, 50, 94, 44],
    [188, 50, 104, 44],
    [308, 50, 84, 44],
    [8, 110, 54, 22],
    [78, 110, 94, 22],
    [188, 110, 104, 22],
    [308, 110, 84, 22],
  ];

  return (
    <div className="relative h-36 border-b border-line bg-sunken" aria-hidden>
      <svg viewBox="0 0 400 140" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
        {quarteiroes.map(([x, y, largura, altura], i) => (
          <rect
            key={i}
            x={x}
            y={y}
            width={largura}
            height={altura}
            rx="3"
            className={i === 6 ? "fill-signal-soft stroke-line-strong" : "fill-surface stroke-line"}
            strokeWidth="1"
          />
        ))}
        <path
          d="M0 128 L400 14"
          className="stroke-brand"
          strokeWidth="2"
          strokeDasharray="2 6"
          strokeLinecap="round"
          fill="none"
          opacity="0.5"
        />
        <g transform="translate(240 72)">
          <circle r="14" className="fill-signal" opacity="0.25" />
          <circle r="7" className="fill-signal stroke-ink" strokeWidth="2" />
        </g>
      </svg>
    </div>
  );
}
