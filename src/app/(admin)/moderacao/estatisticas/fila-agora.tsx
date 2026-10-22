import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import type { IdadesDaFila } from "@/lib/moderacao/estatisticas";
import { formatarDuracao } from "@/lib/util/formatarEstatistica";

import { SecaoEstatistica } from "./partes";

export interface FilaAgora {
  chave: "reclamacoes" | "comentarios" | "denuncias";
  href: string;
  idades: IdadesDaFila;
}

// Mesmos cortes e mesma gramática de cor do TempoNaFila: neutro até um dia,
// âmbar até três, vermelho depois. Os números ao lado repetem o que a cor diz.
const FAIXAS = [
  { chave: "ate24h", cor: "bg-line-strong", rotulo: "idadeAte24" },
  { chave: "de24a72h", cor: "bg-warn-ink", rotulo: "idade24a72" },
  { chave: "mais72h", cor: "bg-danger-ink", rotulo: "idadeMais72" },
] as const;

export function FilaAgora({ filas }: { filas: FilaAgora[] }) {
  const t = useTranslations("Estatisticas");
  const locale = useLocale();

  return (
    <SecaoEstatistica id="fila" titulo={t("filaTitulo")} descricao={t("filaDescricao")}>
      <ul className="grid gap-x-8 gap-y-5 md:grid-cols-3">
        {filas.map(({ chave, href, idades }) => (
          <li key={chave} className="flex min-w-0 flex-col gap-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <Link
                href={href}
                className="group inline-flex items-center gap-1 rounded text-sm font-medium text-ink-2 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {t(`fila.${chave}`)}
                <ArrowRight
                  className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                  aria-hidden
                />
              </Link>
              <span className="font-mono text-2xl font-semibold tabular-nums text-ink">
                {idades.total}
              </span>
            </div>

            {idades.total === 0 ? (
              <p className="flex items-center gap-1.5 text-sm text-ok-ink">
                <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
                {t("filaVazia")}
              </p>
            ) : (
              <>
                <div aria-hidden className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-sunken">
                  {FAIXAS.map(
                    ({ chave: faixa, cor }) =>
                      idades[faixa] > 0 && (
                        <div
                          key={faixa}
                          className={cor}
                          style={{ width: `${(idades[faixa] / idades.total) * 100}%` }}
                        />
                      )
                  )}
                </div>
                <ul className="flex flex-col gap-1 text-xs text-ink-muted">
                  {FAIXAS.filter(({ chave: faixa }) => idades[faixa] > 0).map(({ chave: faixa, cor, rotulo }) => (
                    <li key={faixa} className="flex items-center gap-1.5">
                      <span aria-hidden className={`h-2 w-2 rounded-sm ${cor}`} />
                      <span className="font-mono font-medium tabular-nums text-ink-2">
                        {idades[faixa]}
                      </span>
                      {t(rotulo)}
                    </li>
                  ))}
                </ul>
                {idades.maisAntigaMs !== null && (
                  <p className="text-xs text-ink-muted">
                    {t("maisAntiga", { tempo: formatarDuracao(idades.maisAntigaMs, locale) })}
                  </p>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </SecaoEstatistica>
  );
}
