import { BarChart3 } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { BarraDecisoes } from "@/components/barra-decisoes";
import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { EstadoVazio } from "@/components/estado-vazio";
import { PainelNumeros } from "@/components/painel-numeros";
import { cartao, containerPagina } from "@/lib/estilos";
import { metadataDaPagina } from "@/lib/metadata";

import { exigirModerador } from "../exigir-moderador";

const DIAS_VOLUME = 14;

function BarraScore({ rotulo, valor }: { rotulo: string; valor: number | null }) {
  const pct = valor !== null ? Math.round(valor * 100) : null;
  return (
    <div className="flex items-center gap-3">
      <span className="w-40 shrink-0 text-sm text-slate-600 dark:text-slate-400">{rotulo}</span>
      <div aria-hidden className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct ?? 0}%` }}
        />
      </div>
      <span className="w-12 shrink-0 text-right font-mono text-sm font-medium tabular-nums text-slate-700 dark:text-slate-300">
        {pct !== null ? `${pct}%` : "—"}
      </span>
    </div>
  );
}

function formatarDiaChave(data: Date) {
  return data.toISOString().slice(0, 10);
}

function formatarDiaCurto(chave: string) {
  const [, mes, dia] = chave.split("-");
  return `${dia}/${mes}`;
}

export const generateMetadata = metadataDaPagina("Estatisticas");

export default async function EstatisticasModeracaoPage() {
  const t = await getTranslations("Estatisticas");
  await exigirModerador();

  const agora = new Date();
  const desde = new Date(agora.getTime() - DIAS_VOLUME * 86_400_000);
  desde.setHours(0, 0, 0, 0);

  const [
    porTipoEDecisao,
    agregadoReclamacao,
    agregadoComentario,
    revisadosHumano,
    logsRecentes,
  ] = await Promise.all([
    prisma.logModeracao.groupBy({
      by: ["alvoTipo", "decisao"],
      _count: { _all: true },
    }),
    prisma.logModeracao.aggregate({
      where: { alvoTipo: "RECLAMACAO" },
      _avg: {
        latenciaMs: true,
        scoreOfensivo: true,
        scoreSpam: true,
        scoreDadosPessoais: true,
        scoreForaEscopo: true,
        scoreDesinformacao: true,
        coerenciaTextoImagem: true,
      },
      _count: { _all: true },
    }),
    prisma.logModeracao.aggregate({
      where: { alvoTipo: "COMENTARIO" },
      _avg: { latenciaMs: true, scoreOfensivo: true, scoreSpam: true, scoreDadosPessoais: true },
      _count: { _all: true },
    }),
    prisma.logModeracao.findMany({
      where: { decisaoFinal: { not: null } },
      select: { decisao: true, decisaoFinal: true },
    }),
    prisma.logModeracao.findMany({
      where: { createdAt: { gte: desde } },
      select: { createdAt: true },
    }),
  ]);

  const totalAnalises = porTipoEDecisao.reduce((soma, item) => soma + item._count._all, 0);
  const totalAprovado = porTipoEDecisao
    .filter((item) => item.decisao === "APROVAR")
    .reduce((soma, item) => soma + item._count._all, 0);
  const taxaAprovacao = totalAnalises > 0 ? Math.round((totalAprovado / totalAnalises) * 100) : null;

  const totalRevisados = revisadosHumano.length;
  const totalConcordou = revisadosHumano.filter((log) => log.decisaoFinal === log.decisao).length;
  const concordanciaHumana =
    totalRevisados > 0 ? Math.round((totalConcordou / totalRevisados) * 100) : null;

  const latenciaMediaMs = agregadoReclamacao._avg.latenciaMs ?? agregadoComentario._avg.latenciaMs;

  const diasChaves: string[] = [];
  for (let i = DIAS_VOLUME - 1; i >= 0; i--) {
    diasChaves.push(formatarDiaChave(new Date(agora.getTime() - i * 86_400_000)));
  }
  const contagemPorDia = new Map(diasChaves.map((chave) => [chave, 0]));
  for (const log of logsRecentes) {
    const chave = formatarDiaChave(log.createdAt);
    contagemPorDia.set(chave, (contagemPorDia.get(chave) ?? 0) + 1);
  }
  const volumeDiario = diasChaves.map((chave) => ({
    chave,
    total: contagemPorDia.get(chave) ?? 0,
  }));
  const maximoVolume = Math.max(...volumeDiario.map((d) => d.total), 1);
  const totalVolumePeriodo = volumeDiario.reduce((soma, dia) => soma + dia.total, 0);
  const diaPico = volumeDiario.reduce(
    (maior, dia) => (dia.total > maior.total ? dia : maior),
    volumeDiario[0]
  );
  const chaveHoje = formatarDiaChave(agora);

  const linhasPorTipo = (["RECLAMACAO", "COMENTARIO"] as const).map((tipo) => ({
    tipo,
    decisoes: porTipoEDecisao.filter((item) => item.alvoTipo === tipo),
  }));

  return (
    <main className={`${containerPagina} max-w-3xl`}>
      <CabecalhoPagina titulo={t("titulo")} descricao={t("subtitulo")} />

      {totalAnalises === 0 ? (
        <EstadoVazio icone={BarChart3} titulo={t("nenhumaAnalise")} />
      ) : (
        <>
          <PainelNumeros
            itens={[
              { rotulo: t("analisesNoTotal"), valor: String(totalAnalises) },
              { rotulo: t("taxaAprovacao"), valor: taxaAprovacao !== null ? `${taxaAprovacao}%` : "—" },
              {
                rotulo: t("tempoMedioResposta"),
                valor: latenciaMediaMs != null ? `${(latenciaMediaMs / 1000).toFixed(1)}s` : "—",
              },
              {
                rotulo: t("concordanciaHumana"),
                valor: concordanciaHumana !== null ? `${concordanciaHumana}%` : t("semRevisaoAinda"),
              },
            ]}
          />

          <div className={`flex flex-col gap-3 ${cartao}`}>
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">
              {t("decisoesPorTipo")}
            </h2>
            {linhasPorTipo.map(({ tipo, decisoes }) => {
              const total = decisoes.reduce((soma, item) => soma + item._count._all, 0);
              if (total === 0) return null;
              return (
                <div key={tipo} className="flex flex-col gap-2">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {tipo === "RECLAMACAO" ? t("reclamacoes") : t("comentarios")} ({total})
                  </p>
                  <BarraDecisoes
                    contagens={Object.fromEntries(
                      decisoes.map((item) => [item.decisao, item._count._all])
                    )}
                  />
                </div>
              );
            })}
          </div>

          {agregadoReclamacao._count._all > 0 && (
            <div className={`flex flex-col gap-3 ${cartao}`}>
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                {t("scoreMedioReclamacoes")}
              </h2>
              <BarraScore rotulo={t("ofensivo")} valor={agregadoReclamacao._avg.scoreOfensivo} />
              <BarraScore rotulo={t("spam")} valor={agregadoReclamacao._avg.scoreSpam} />
              <BarraScore
                rotulo={t("dadosPessoais")}
                valor={agregadoReclamacao._avg.scoreDadosPessoais}
              />
              <BarraScore
                rotulo={t("foraDeEscopo")}
                valor={agregadoReclamacao._avg.scoreForaEscopo}
              />
              <BarraScore
                rotulo={t("desinformacao")}
                valor={agregadoReclamacao._avg.scoreDesinformacao}
              />
              <BarraScore
                rotulo={t("coerenciaTextoImagem")}
                valor={agregadoReclamacao._avg.coerenciaTextoImagem}
              />
            </div>
          )}

          {agregadoComentario._count._all > 0 && (
            <div className={`flex flex-col gap-3 ${cartao}`}>
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                {t("scoreMedioComentarios")}
              </h2>
              <BarraScore rotulo={t("ofensivo")} valor={agregadoComentario._avg.scoreOfensivo} />
              <BarraScore rotulo={t("spam")} valor={agregadoComentario._avg.scoreSpam} />
              <BarraScore
                rotulo={t("dadosPessoais")}
                valor={agregadoComentario._avg.scoreDadosPessoais}
              />
            </div>
          )}

          <div className={`flex flex-col gap-3 ${cartao}`}>
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                {t("volumeUltimosDias", { dias: DIAS_VOLUME })}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("analisesNoPeriodo", { analises: t("analises", { count: totalVolumePeriodo }) })}
                {diaPico.total > 0 &&
                  ` · ${t("picoDe", { total: diaPico.total, data: formatarDiaCurto(diaPico.chave) })}`}
              </p>
            </div>
            <div className="flex h-32 gap-1">
              {volumeDiario.map((dia) => (
                <div
                  key={dia.chave}
                  title={`${formatarDiaCurto(dia.chave)}: ${t("analises", { count: dia.total })}`}
                  className="flex flex-1 flex-col items-center justify-end gap-0.5"
                >
                  {dia.total > 0 && (
                    <span className="text-[10px] leading-none text-slate-500 dark:text-slate-400">
                      {dia.total}
                    </span>
                  )}
                  <div
                    // Hoje ganha a cor de destaque (accent) em vez do azul
                    // padrão - só pra dar uma âncora temporal rápida, sem
                    // precisar de outro elemento (legenda, marcador etc.)
                    // que pesaria mais no gráfico.
                    className={`w-full rounded-t transition-colors ${
                      dia.chave === chaveHoje
                        ? "bg-accent"
                        : "bg-primary/70 hover:bg-primary"
                    }`}
                    style={{
                      height: `${dia.total > 0 ? Math.max((dia.total / maximoVolume) * 100, 4) : 1}%`,
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500">
              <span>{formatarDiaCurto(volumeDiario[0].chave)}</span>
              <span>{formatarDiaCurto(volumeDiario[volumeDiario.length - 1].chave)}</span>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
