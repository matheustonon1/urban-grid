import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

export type ChaveEtapa = "titulo" | "descricao" | "categoria" | "local" | "declaracao";

const painel =
  "flex flex-col gap-3 rounded-lg border border-line bg-surface p-4";
const tituloPainel =
  "text-xs font-semibold tracking-wide text-ink-muted uppercase";

// O que falta preencher, em tempo real. Não impede o envio (quem valida é o
// servidor) - só responde "falta muito?" sem a pessoa ter que rolar a página.
export function ProgressoPreenchimento({
  etapas,
}: {
  etapas: { chave: ChaveEtapa; ok: boolean }[];
}) {
  const t = useTranslations("NovaReclamacao");
  const feitas = etapas.filter((etapa) => etapa.ok).length;
  const completo = feitas === etapas.length;

  return (
    <section aria-labelledby="progresso-titulo" className={painel}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="progresso-titulo" className={tituloPainel}>
          {t("progresso")}
        </h2>
        <span className="font-mono text-sm font-medium tabular-nums text-ink-2">
          {feitas}/{etapas.length}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={etapas.length}
        aria-valuenow={feitas}
        aria-label={t("progressoContagem", { feitas, total: etapas.length })}
        className="h-1.5 overflow-hidden rounded-full bg-sunken"
      >
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${(feitas / etapas.length) * 100}%` }}
        />
      </div>
      <ul className="flex flex-col gap-2">
        {etapas.map(({ chave, ok }) => (
          <li key={chave} className="flex items-center gap-2.5 text-sm">
            <span
              aria-hidden
              className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border ${
                ok
                  ? "border-brand bg-brand text-on-brand"
                  : "border-line-strong"
              }`}
            >
              {ok && <Check className="h-3 w-3" strokeWidth={3} />}
            </span>
            <span
              className={
                ok
                  ? "text-ink-muted"
                  : "font-medium text-ink-2"
              }
            >
              {t(`etapa.${chave}`)}
              <span className="sr-only"> ({ok ? t("etapaFeita") : t("etapaPendente")})</span>
            </span>
          </li>
        ))}
      </ul>
      {completo && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-ok-ink">
          <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
          {t("tudoPronto")}
        </p>
      )}
    </section>
  );
}

const CHAVES_DICAS = ["dica1", "dica2", "dica3", "dica4"] as const;

export function ListaDeDicas() {
  const t = useTranslations("NovaReclamacao");
  return (
    <ul className="flex flex-col gap-2.5">
      {CHAVES_DICAS.map((chave) => (
        <li key={chave} className="flex items-start gap-2.5 text-sm text-ink-2">
          <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />
          {t(chave)}
        </li>
      ))}
    </ul>
  );
}

export function DicasReclamacao() {
  const t = useTranslations("NovaReclamacao");
  return (
    <section aria-labelledby="dicas-titulo" className={painel}>
      <h2 id="dicas-titulo" className={tituloPainel}>
        {t("dicasTitulo")}
      </h2>
      <ListaDeDicas />
    </section>
  );
}

const PASSOS = ["passo1", "passo2", "passo3", "passo4"] as const;

// O caminho depois do envio, no mesmo vocabulário do acompanhamento da
// reclamação: a pessoa sabe o que esperar antes de clicar em "Enviar".
export function DepoisDeEnviar() {
  const t = useTranslations("NovaReclamacao");
  return (
    <section aria-labelledby="depois-titulo" className={painel}>
      <h2 id="depois-titulo" className={tituloPainel}>
        {t("depoisTitulo")}
      </h2>
      <ol className="flex flex-col">
        {PASSOS.map((passo, indice) => (
          <li key={passo} className="relative flex gap-3 pb-4 last:pb-0">
            {indice < PASSOS.length - 1 && (
              <span
                aria-hidden
                className="absolute top-7 bottom-1 left-2.75 w-0.5 bg-line"
              />
            )}
            <span
              aria-hidden
              className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-line-strong bg-surface font-mono text-[11px] font-semibold text-ink-muted"
            >
              {indice + 1}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-sm font-medium text-ink-2">
                {t(`${passo}Titulo`)}
              </p>
              <p className="text-xs leading-relaxed text-ink-muted">
                {t(`${passo}Desc`)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
