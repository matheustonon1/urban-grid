import { useLocale, useTranslations } from "next-intl";

import { COR_DECISAO } from "@/components/moderacao/barra-decisoes";
import {
  LIMITE_REPROVACAO,
  LIMITE_REVISAO,
  maximoLegivel,
  type FaixaHistograma,
} from "@/lib/moderacao/estatisticas";
import { formatarNumero, formatarPorcentagem } from "@/lib/util/formatarEstatistica";

import { SecaoEstatistica, VerComoTabela } from "./partes";

// A cor da barra é a decisão que aquela faixa de pontuação produz (mesmas
// cores de BarraDecisoes); a zona também é nomeada em texto embaixo.
const COR_ZONA = {
  ok: COR_DECISAO.APROVAR,
  atencao: COR_DECISAO.ENCAMINHAR_REVISAO,
  alto: COR_DECISAO.REPROVAR,
} as const;

const ZONAS = [
  { chave: "ok", rotulo: "zonaAprovada" },
  { chave: "atencao", rotulo: "zonaRevisao" },
  { chave: "alto", rotulo: "zonaReprovada" },
] as const;

export function HistogramaPontuacoes({
  faixas,
  mediana,
}: {
  faixas: FaixaHistograma[];
  mediana: number | null;
}) {
  const t = useTranslations("Estatisticas");
  const locale = useLocale();

  const total = faixas.reduce((soma, f) => soma + f.quantidade, 0);
  const teto = maximoLegivel(Math.max(...faixas.map((f) => f.quantidade)));
  const num = (valor: number) => formatarNumero(valor, locale, 2);
  const faixaTexto = (f: FaixaHistograma) => `${num(f.de)} – ${num(f.ate)}`;

  const porZona = ZONAS.map(({ chave, rotulo }) => {
    const quantidade = faixas.filter((f) => f.zona === chave).reduce((soma, f) => soma + f.quantidade, 0);
    return { chave, rotulo, quantidade, fracao: total > 0 ? quantidade / total : null };
  });

  return (
    <SecaoEstatistica
      id="pontuacoes"
      titulo={t("scoreTitulo")}
      descricao={t("scoreDescricao", { revisao: num(LIMITE_REVISAO), reprovacao: num(LIMITE_REPROVACAO) })}
      lateral={
        mediana !== null && (
          <p className="text-right text-sm text-ink-muted">
            {t("scoreMediana", { valor: num(mediana) })}
          </p>
        )
      }
    >
      <div role="group" aria-label={t("scoreTitulo")} className="flex gap-3">
        <div aria-hidden className="relative h-36 w-8 shrink-0 font-mono text-[11px] tabular-nums text-ink-muted">
          <span className="absolute top-0 right-0 -translate-y-1/2">{teto}</span>
          <span className="absolute top-1/2 right-0 -translate-y-1/2">{teto / 2}</span>
          <span className="absolute right-0 bottom-0 translate-y-1/2">0</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative h-36">
            <div aria-hidden className="absolute inset-x-0 top-0 border-t border-line" />
            <div aria-hidden className="absolute inset-x-0 top-1/2 border-t border-line" />
            <div aria-hidden className="absolute inset-x-0 bottom-0 border-t border-line-strong" />

            {/* Cortes que o pipeline usa pra decidir. */}
            {[LIMITE_REVISAO, LIMITE_REPROVACAO].map((corte) => (
              <div
                key={corte}
                aria-hidden
                className="absolute inset-y-0 border-l border-dashed border-ink-faint"
                style={{ left: `${corte * 100}%` }}
              />
            ))}

            <div className="absolute inset-0 flex items-end gap-0.5">
              {faixas.map((faixa, indice) => {
                const linhas = [faixaTexto(faixa), t("analises", { count: faixa.quantidade })];
                return (
                  <div
                    key={faixa.de}
                    role="img"
                    aria-label={linhas.join(": ")}
                    className="group relative flex h-full min-w-0 flex-1 items-end"
                  >
                    {faixa.quantidade > 0 && (
                      <div
                        className={`w-full rounded-t ${COR_ZONA[faixa.zona]}`}
                        style={{ height: `${(faixa.quantidade / teto) * 100}%`, minHeight: 2 }}
                      />
                    )}
                    <div
                      aria-hidden
                      className={`pointer-events-none absolute z-20 mb-1.5 hidden rounded-lg bg-ink px-2.5 py-1.5 text-xs whitespace-nowrap text-paper shadow-lg group-hover:block ${
                        indice < faixas.length * 0.25
                          ? "left-0"
                          : indice > faixas.length * 0.75
                            ? "right-0"
                            : "left-1/2 -translate-x-1/2"
                      }`}
                      style={{ bottom: `${(faixa.quantidade / teto) * 100}%` }}
                    >
                      <span className="block font-semibold">{linhas[0]}</span>
                      <span className="block">{linhas[1]}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Eixo horizontal: só 0, os dois cortes e 1 (marcas seletivas). */}
          <div aria-hidden className="relative mt-1.5 h-4 font-mono text-[11px] tabular-nums text-ink-muted">
            {[
              { valor: 0, deslocamento: "" },
              { valor: LIMITE_REVISAO, deslocamento: "-translate-x-1/2" },
              { valor: LIMITE_REPROVACAO, deslocamento: "-translate-x-1/2" },
              { valor: 1, deslocamento: "-translate-x-full" },
            ].map(({ valor, deslocamento }) => (
              <span key={valor} className={`absolute top-0 ${deslocamento}`} style={{ left: `${valor * 100}%` }}>
                {num(valor)}
              </span>
            ))}
          </div>

          {/* Cada zona, com nome e quanto das análises caiu nela. */}
          <ul className="mt-2 flex gap-0.5 text-xs">
            {porZona.map(({ chave, rotulo, quantidade, fracao }, i) => (
              <li
                key={chave}
                className="flex min-w-0 flex-col gap-0.5 text-ink-muted"
                // Largura proporcional ao trecho da escala que a zona cobre,
                // pra ficar embaixo das barras dela.
                style={{
                  flex: `${[LIMITE_REVISAO, LIMITE_REPROVACAO - LIMITE_REVISAO, 1 - LIMITE_REPROVACAO][i]} 1 0`,
                }}
              >
                <span aria-hidden className={`mb-1 h-0.5 w-full ${COR_ZONA[chave]}`} />
                <span className="font-medium text-ink-2">{t(rotulo)}</span>
                <span className="font-mono tabular-nums">
                  {quantidade} · {formatarPorcentagem(fracao, locale)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <VerComoTabela
        cabecalhos={[t("colFaixa"), t("colAnalises")]}
        linhas={faixas.map((f) => [faixaTexto(f), f.quantidade])}
      />
    </SecaoEstatistica>
  );
}
