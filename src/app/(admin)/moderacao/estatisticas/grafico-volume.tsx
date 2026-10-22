import { useLocale, useTranslations } from "next-intl";

import { COR_DECISAO } from "@/components/moderacao/barra-decisoes";
import { maximoLegivel, type BucketVolume, type Granularidade } from "@/lib/moderacao/estatisticas";
import { formatarBucket } from "@/lib/util/formatarEstatistica";

import { COR_FALHA, LegendaDecisoes, SecaoEstatistica, VerComoTabela } from "./partes";

// Posição do balão de hover: nas pontas ele abre pro lado de dentro, pra não
// sair do cartão.
function posicaoBalao(indice: number, total: number) {
  if (indice < total * 0.25) return "left-0";
  if (indice > total * 0.75) return "right-0";
  return "left-1/2 -translate-x-1/2";
}

export function GraficoVolume({
  buckets,
  granularidade,
}: {
  buckets: BucketVolume[];
  granularidade: Granularidade;
}) {
  const t = useTranslations("Estatisticas");
  const tDecisao = useTranslations("Decisao");
  const locale = useLocale();

  const totalGeral = buckets.reduce((soma, b) => soma + b.total, 0);
  const pico = buckets.reduce((maior, b) => (b.total > maior.total ? b : maior), buckets[0]);
  const teto = maximoLegivel(pico.total);
  const temFalhas = buckets.some((b) => b.falhas > 0);
  const rotulo = (b: BucketVolume) => formatarBucket(b.inicio, granularidade, locale);

  // Primeira linha: período e total; depois, uma linha por decisão que houve.
  const linhasDoBucket = (b: BucketVolume): string[] => [
    `${rotulo(b)}: ${t("analises", { count: b.total })}`,
    ...(b.aprovar > 0 ? [`${tDecisao("APROVAR")}: ${b.aprovar}`] : []),
    ...(b.encaminhar > 0 ? [`${tDecisao("ENCAMINHAR_REVISAO")}: ${b.encaminhar}`] : []),
    ...(b.reprovar > 0 ? [`${tDecisao("REPROVAR")}: ${b.reprovar}`] : []),
    ...(b.falhas > 0 ? [`${t("falhaDaIA")}: ${b.falhas}`] : []),
  ];

  const meio = buckets[Math.floor((buckets.length - 1) / 2)];

  return (
    <SecaoEstatistica
      id="volume"
      titulo={t("volumeTitulo")}
      descricao={t(
        granularidade === "dia"
          ? "volumeDescricaoDia"
          : granularidade === "semana"
            ? "volumeDescricaoSemana"
            : "volumeDescricaoMes"
      )}
      lateral={
        <p className="text-right text-sm text-slate-600 dark:text-slate-400">
          <span className="font-mono font-medium tabular-nums text-slate-900 dark:text-slate-100">
            {t("analises", { count: totalGeral })}
          </span>
          {pico.total > 0 && (
            <>
              <br />
              {t(granularidade === "semana" ? "volumePicoSemana" : "volumePico", {
                total: pico.total,
                data: rotulo(pico),
              })}
            </>
          )}
        </p>
      }
    >
      <LegendaDecisoes comFalhas={temFalhas} />

      <div role="group" aria-label={t("volumeTitulo")} className="flex gap-3">
        <div aria-hidden className="relative mt-5 h-44 w-8 shrink-0 font-mono text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
          <span className="absolute top-0 right-0 -translate-y-1/2">{teto}</span>
          <span className="absolute top-1/2 right-0 -translate-y-1/2">{teto / 2}</span>
          <span className="absolute right-0 bottom-0 translate-y-1/2">0</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative mt-5 h-44">
            {/* Linhas de grade: fio de 1px sólido, mais fraco que os dados. */}
            <div aria-hidden className="absolute inset-x-0 top-0 border-t border-slate-200 dark:border-slate-800" />
            <div aria-hidden className="absolute inset-x-0 top-1/2 border-t border-slate-200 dark:border-slate-800" />
            <div aria-hidden className="absolute inset-x-0 bottom-0 border-t border-slate-300 dark:border-slate-700" />

            <div className="absolute inset-0 flex items-end gap-0.5">
              {buckets.map((bucket, indice) => {
                const segmentos = [
                  { chave: "falhas", n: bucket.falhas, cor: COR_FALHA },
                  { chave: "reprovar", n: bucket.reprovar, cor: COR_DECISAO.REPROVAR },
                  { chave: "encaminhar", n: bucket.encaminhar, cor: COR_DECISAO.ENCAMINHAR_REVISAO },
                  { chave: "aprovar", n: bucket.aprovar, cor: COR_DECISAO.APROVAR },
                ].filter((segmento) => segmento.n > 0);
                const linhas = linhasDoBucket(bucket);

                return (
                  <div
                    key={bucket.chave}
                    role="img"
                    aria-label={linhas.join(", ")}
                    className="group relative flex h-full min-w-0 flex-1 items-end justify-center"
                  >
                    {bucket.total === 0 ? (
                      <span aria-hidden className="h-px w-full max-w-6 bg-slate-300 dark:bg-slate-600" />
                    ) : (
                      <div
                        className="relative flex w-full max-w-6 flex-col gap-0.5"
                        style={{ height: `${(bucket.total / teto) * 100}%` }}
                      >
                        {bucket === pico && (
                          <span
                            aria-hidden
                            className="absolute bottom-full left-1/2 mb-0.5 -translate-x-1/2 font-mono text-[11px] font-medium tabular-nums text-slate-700 dark:text-slate-300"
                          >
                            {bucket.total}
                          </span>
                        )}
                        {segmentos.map((segmento, i) => (
                          <div
                            key={segmento.chave}
                            className={`min-h-0.5 ${segmento.cor} ${i === 0 ? "rounded-t" : ""}`}
                            style={{ flex: `${segmento.n} 1 0` }}
                          />
                        ))}
                      </div>
                    )}

                    <div
                      aria-hidden
                      className={`pointer-events-none absolute z-20 mb-1.5 hidden rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg group-hover:block dark:bg-slate-100 dark:text-slate-900 ${posicaoBalao(indice, buckets.length)}`}
                      style={{ bottom: bucket.total === 0 ? "0" : `${(bucket.total / teto) * 100}%` }}
                    >
                      {linhas.map((linha, i) => (
                        <span key={i} className={`block ${i === 0 ? "font-semibold" : ""}`}>
                          {linha}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            aria-hidden
            className="mt-2 flex justify-between font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400"
          >
            <span>{rotulo(buckets[0])}</span>
            {buckets.length > 6 && <span>{rotulo(meio)}</span>}
            <span>{rotulo(buckets[buckets.length - 1])}</span>
          </div>
        </div>
      </div>

      <VerComoTabela
        cabecalhos={[
          t("colPeriodo"),
          tDecisao("APROVAR"),
          tDecisao("ENCAMINHAR_REVISAO"),
          tDecisao("REPROVAR"),
          ...(temFalhas ? [t("falhaDaIA")] : []),
          t("colTotal"),
        ]}
        linhas={buckets.map((b) => [
          rotulo(b),
          b.aprovar,
          b.encaminhar,
          b.reprovar,
          ...(temFalhas ? [b.falhas] : []),
          b.total,
        ])}
      />
    </SecaoEstatistica>
  );
}
