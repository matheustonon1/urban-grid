import { useLocale, useTranslations } from "next-intl";

import type { DisparoPorEixo } from "@/lib/moderacao/estatisticas";
import { formatarNumero, formatarPorcentagem } from "@/lib/util/formatarEstatistica";

import { SecaoEstatistica } from "./partes";

export interface GrupoDeEixos {
  tipo: "RECLAMACAO" | "COMENTARIO";
  corte: number;
  dados: DisparoPorEixo[];
}

// Em quantas análises cada critério passou do corte de atenção. Barra
// única (uma série só, sempre em azul): o valor está escrito ao lado, então
// a barra serve de comparação rápida, não de leitura. A média do risco fica
// como texto discreto - é outra grandeza e não cabe no mesmo eixo.
export function EixosQueDisparam({ grupos }: { grupos: GrupoDeEixos[] }) {
  const t = useTranslations("Estatisticas");
  const locale = useLocale();

  return (
    <SecaoEstatistica id="eixos" titulo={t("eixosTitulo")} descricao={t("eixosDescricao")}>
      <div className="grid gap-x-10 gap-y-7 lg:grid-cols-2">
        {grupos.map(({ tipo, corte, dados }) => (
          <div key={tipo} className="flex min-w-0 flex-col gap-3">
            <h3 className="text-sm font-medium text-ink-2">
              {tipo === "RECLAMACAO"
                ? t("eixosReclamacoes", { corte: formatarNumero(corte, locale, 2) })
                : t("eixosComentarios", { corte: formatarNumero(corte, locale, 2) })}
            </h3>
            {dados.every((eixo) => eixo.amostra === 0) ? (
              <p className="text-sm text-ink-muted">{t("semDados")}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {dados.map((eixo) => (
                  <li key={eixo.eixo} className="grid grid-cols-[8.5rem_minmax(0,1fr)_auto] items-center gap-x-3">
                    <div className="flex min-w-0 flex-col">
                      <span className="text-sm leading-snug text-ink-2">
                        {t(eixo.eixo)}
                      </span>
                      {eixo.mediaRisco !== null && (
                        <span className="text-xs text-ink-muted">
                          {t("eixoMedia", { valor: formatarNumero(eixo.mediaRisco, locale, 2) })}
                        </span>
                      )}
                    </div>
                    <div
                      role="img"
                      aria-label={`${t(eixo.eixo)}: ${formatarPorcentagem(eixo.taxa, locale)} (${eixo.disparos}/${eixo.amostra})`}
                      className="h-2 overflow-hidden rounded-full bg-sunken"
                    >
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{ width: `${(eixo.taxa ?? 0) * 100}%` }}
                      />
                    </div>
                    <span className="text-right font-mono text-sm tabular-nums text-ink-2">
                      {formatarPorcentagem(eixo.taxa, locale)}
                      <span className="block text-xs text-ink-muted">
                        {eixo.disparos}/{eixo.amostra}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {tipo === "RECLAMACAO" && dados.some((eixo) => eixo.eixo === "coerenciaTextoImagem" && eixo.amostra > 0) && (
              <p className="text-xs text-ink-muted">{t("eixoCoerenciaNota")}</p>
            )}
          </div>
        ))}
      </div>
    </SecaoEstatistica>
  );
}
