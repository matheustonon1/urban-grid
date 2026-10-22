import { useLocale, useTranslations } from "next-intl";

import type { Consumo, LinhaVersao } from "@/lib/moderacao/estatisticas";
import { formatarData } from "@/lib/util/formatarData";
import { formatarLatencia, formatarNumero, formatarPorcentagem } from "@/lib/util/formatarEstatistica";

import { SecaoEstatistica } from "./partes";

export function VersoesDoPrompt({ linhas }: { linhas: LinhaVersao[] }) {
  const t = useTranslations("Estatisticas");
  const locale = useLocale();
  const colunas = [
    t("colTipo"),
    t("colVersao"),
    t("colAnalises"),
    t("colAprovadas"),
    t("colRevisao"),
    t("colReprovadas"),
    t("colLatencia"),
    t("colUltimoUso"),
  ];

  return (
    <SecaoEstatistica id="versoes" titulo={t("versoesTitulo")} descricao={t("versoesDescricao")}>
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-136 text-left text-sm tabular-nums">
          <thead className="text-xs text-slate-500 dark:text-slate-400">
            <tr className="border-b border-slate-200 dark:border-slate-800">
              {colunas.map((coluna, i) => (
                <th key={coluna} scope="col" className={`px-2 py-2 font-medium ${i > 1 ? "text-right" : ""}`}>
                  {coluna}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {linhas.map((linha) => (
              <tr key={`${linha.tipo}-${linha.versao}`}>
                <td className="px-2 py-2.5 text-slate-700 dark:text-slate-300">
                  {linha.tipo === "RECLAMACAO" ? t("reclamacoes") : t("comentarios")}
                </td>
                <td className="px-2 py-2.5 font-mono font-medium text-slate-900 dark:text-slate-100">
                  {linha.versao}
                </td>
                <td className="px-2 py-2.5 text-right font-mono">{linha.analises}</td>
                <td className="px-2 py-2.5 text-right font-mono">{formatarPorcentagem(linha.taxaAprovar, locale)}</td>
                <td className="px-2 py-2.5 text-right font-mono">{formatarPorcentagem(linha.taxaEncaminhar, locale)}</td>
                <td className="px-2 py-2.5 text-right font-mono">{formatarPorcentagem(linha.taxaReprovar, locale)}</td>
                <td className="px-2 py-2.5 text-right font-mono">{formatarLatencia(linha.latenciaP50Ms, locale)}</td>
                <td className="px-2 py-2.5 text-right text-slate-500 dark:text-slate-400">
                  {formatarData(linha.ultimaVez, locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SecaoEstatistica>
  );
}

export function ConsumoDoModelo({ consumo }: { consumo: Consumo }) {
  const t = useTranslations("Estatisticas");
  const locale = useLocale();

  const grupos = [
    {
      titulo: t("consumoTokens"),
      itens: [
        { rotulo: t("consumoEntrada"), valor: formatarNumero(consumo.tokensEntrada, locale) },
        { rotulo: t("consumoSaida"), valor: formatarNumero(consumo.tokensSaida, locale) },
        { rotulo: t("consumoPorAnalise"), valor: formatarNumero(consumo.tokensPorAnalise, locale) },
      ],
    },
    {
      titulo: t("consumoLatencia"),
      itens: [
        { rotulo: t("consumoMediana"), valor: formatarLatencia(consumo.latenciaP50Ms, locale) },
        { rotulo: t("consumoP95"), valor: formatarLatencia(consumo.latenciaP95Ms, locale) },
        { rotulo: t("consumoMaximo"), valor: formatarLatencia(consumo.latenciaMaxMs, locale) },
      ],
    },
  ];

  return (
    <SecaoEstatistica id="consumo" titulo={t("consumoTitulo")} descricao={t("consumoDescricao")}>
      <div className="flex flex-col gap-5">
        {grupos.map(({ titulo, itens }) => (
          <div key={titulo} className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
              {titulo}
            </h3>
            <dl className="grid grid-cols-3 gap-3">
              {itens.map(({ rotulo, valor }) => (
                <div key={rotulo} className="flex flex-col gap-0.5">
                  <dt className="text-xs text-slate-500 dark:text-slate-400">{rotulo}</dt>
                  <dd className="font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    {valor}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </SecaoEstatistica>
  );
}
