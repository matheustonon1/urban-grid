import { useLocale, useTranslations } from "next-intl";

import type { ResumoDenuncias } from "@/lib/estatisticasModeracao";
import { formatarDuracao, formatarPorcentagem } from "@/lib/formatarEstatistica";

import { SecaoEstatistica } from "./partes";

export function DenunciasDoPeriodo({ resumo }: { resumo: ResumoDenuncias }) {
  const t = useTranslations("Estatisticas");
  const tMotivo = useTranslations("MotivoDenuncia");
  const locale = useLocale();

  const numeros = [
    { rotulo: t("denunciasRecebidas"), valor: resumo.total },
    { rotulo: t("denunciasProcedentes"), valor: resumo.procedentes },
    { rotulo: t("denunciasImprocedentes"), valor: resumo.improcedentes },
    { rotulo: t("denunciasEmAberto"), valor: resumo.emAberto },
  ];
  const resolvidas = resumo.procedentes + resumo.improcedentes;
  const maiorMotivo = Math.max(...resumo.porMotivo.map((m) => m.quantidade), 1);

  return (
    <SecaoEstatistica id="denuncias" titulo={t("denunciasTitulo")} descricao={t("denunciasDescricao")}>
      {resumo.total === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("denunciasNenhuma")}</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            {numeros.map(({ rotulo, valor }) => (
              <div key={rotulo} className="flex flex-col gap-0.5">
                <dt className="text-xs text-slate-500 dark:text-slate-400">{rotulo}</dt>
                <dd className="font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {valor}
                </dd>
              </div>
            ))}
          </dl>

          {resolvidas > 0 && (
            <div className="flex flex-col gap-2">
              <div
                role="img"
                aria-label={`${t("denunciasProcedentes")}: ${resumo.procedentes}, ${t("denunciasImprocedentes")}: ${resumo.improcedentes}`}
                className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
              >
                {resumo.procedentes > 0 && (
                  <div className="bg-primary" style={{ flex: `${resumo.procedentes} 1 0` }} />
                )}
                {resumo.improcedentes > 0 && (
                  <div className="bg-slate-400 dark:bg-slate-500" style={{ flex: `${resumo.improcedentes} 1 0` }} />
                )}
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t("denunciasLeitura", { pct: formatarPorcentagem(resumo.taxaProcedente, locale) })}
                {resumo.medianaResolucaoMs !== null &&
                  ` ${t("denunciasMediana", { tempo: formatarDuracao(resumo.medianaResolucaoMs, locale) })}`}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-slate-800 dark:text-slate-200">{t("denunciasPorMotivo")}</h3>
            <ul className="flex flex-col gap-2.5">
              {resumo.porMotivo.map(({ motivo, quantidade }) => (
                <li
                  key={motivo}
                  className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_2rem] items-center gap-x-3 text-sm"
                >
                  <span className="leading-snug text-slate-700 dark:text-slate-300">{tMotivo(motivo)}</span>
                  <div aria-hidden className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(quantidade / maiorMotivo) * 100}%` }}
                    />
                  </div>
                  <span className="text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                    {quantidade}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </SecaoEstatistica>
  );
}
