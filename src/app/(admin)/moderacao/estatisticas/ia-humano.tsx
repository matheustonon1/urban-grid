import { useLocale, useTranslations } from "next-intl";

import { Aviso } from "@/components/ui/aviso";
import { COR_DECISAO } from "@/components/moderacao/barra-decisoes";
import {
  LIMITE_REVISAO,
  type MotivosDeRevisao,
  type RevisaoHumana,
} from "@/lib/moderacao/estatisticas";
import {
  formatarDuracao,
  formatarNumero,
  formatarPorcentagem,
} from "@/lib/util/formatarEstatistica";

import { SecaoEstatistica } from "./partes";

function PainelRevisao({ revisao }: { revisao: RevisaoHumana }) {
  const t = useTranslations("Estatisticas");
  const locale = useLocale();
  const reclamacao = revisao.tipo === "RECLAMACAO";
  const { revisadas, aprovadasPorHumano, rejeitadasPorHumano } = revisao;

  const partes = [
    {
      chave: "aprovadas",
      n: aprovadasPorHumano,
      cor: COR_DECISAO.APROVAR,
      rotulo: t(reclamacao ? "humanoAprovou" : "humanoReverteu"),
    },
    {
      chave: "rejeitadas",
      n: rejeitadasPorHumano,
      cor: COR_DECISAO.REPROVAR,
      rotulo: t(reclamacao ? "humanoRejeitou" : "humanoConfirmou"),
    },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-lg border border-line bg-sunken/60 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-ink-2">
          {t(reclamacao ? "humanoReclamacoesTitulo" : "humanoComentariosTitulo")}
        </h3>
        <span className="font-mono text-2xl font-semibold tabular-nums text-ink">
          {revisao.paraRevisar}
        </span>
      </div>

      {revisadas === 0 ? (
        <p className="text-sm text-ink-muted">{t("humanoSemRevisao")}</p>
      ) : (
        <>
          <div className="flex flex-col gap-2.5">
            <div
              role="img"
              aria-label={partes.map((p) => `${p.rotulo}: ${p.n}`).join(", ")}
              className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-sunken"
            >
              {partes.map((parte) => parte.n > 0 && (
                <div key={parte.chave} className={parte.cor} style={{ flex: `${parte.n} 1 0` }} />
              ))}
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-2">
              {partes.map((parte) => (
                <li key={parte.chave} className="flex items-center gap-1.5">
                  <span aria-hidden className={`h-2 w-2 rounded-full ${parte.cor}`} />
                  {parte.rotulo}
                  <span className="font-mono font-medium tabular-nums">{parte.n}</span>
                  <span className="text-ink-muted">
                    ({formatarPorcentagem(parte.n / revisadas, locale)})
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-sm leading-relaxed text-ink-muted">
            {reclamacao
              ? t("humanoLeituraReclamacao", {
                  pct: formatarPorcentagem(revisao.taxaAprovadaPorHumano, locale),
                  corte: formatarNumero(LIMITE_REVISAO, locale, 2),
                })
              : t("humanoLeituraComentario", {
                  pct: formatarPorcentagem(revisao.taxaAprovadaPorHumano, locale),
                })}
          </p>
        </>
      )}

      {revisao.amostraPequena && revisadas > 0 && (
        <Aviso tom="atencao">{t("humanoAmostra", { count: revisadas })}</Aviso>
      )}

      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-muted">
        <div className="flex gap-1.5">
          <dt>{t("humanoRevisados")}</dt>
          <dd className="font-mono font-medium tabular-nums text-ink-2">{revisadas}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt>{t("humanoPendentes")}</dt>
          <dd className="font-mono font-medium tabular-nums text-ink-2">{revisao.pendentes}</dd>
        </div>
        {revisao.medianaMs !== null && (
          <div className="flex gap-1.5">
            <dt>{t("humanoMediana")}</dt>
            <dd className="font-mono font-medium tabular-nums text-ink-2">
              {formatarDuracao(revisao.medianaMs, locale)}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

// Por que as reclamações foram para a revisão. Lista com barras de uma série
// só: três causas de naturezas diferentes não pedem três cores.
function MotivosDeRevisaoLista({ motivos }: { motivos: MotivosDeRevisao }) {
  const t = useTranslations("Estatisticas");
  const locale = useLocale();
  const total = motivos.porPontuacao + motivos.porRepostagem + motivos.porFalha;
  if (total === 0) return null;

  const linhas = [
    { chave: "pontuacao", n: motivos.porPontuacao, rotulo: t("motivoPontuacao", { corte: formatarNumero(LIMITE_REVISAO, locale, 2) }) },
    { chave: "repostagem", n: motivos.porRepostagem, rotulo: t("motivoRepostagem") },
    { chave: "falha", n: motivos.porFalha, rotulo: t("motivoFalha") },
  ].filter((linha) => linha.n > 0);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <h3 className="text-sm font-medium text-ink-2">{t("motivosTitulo")}</h3>
      <ul className="flex flex-col gap-2.5">
        {linhas.map((linha) => (
          <li key={linha.chave} className="grid grid-cols-[minmax(0,16rem)_minmax(0,1fr)_auto] items-center gap-x-3 text-sm">
            <span className="leading-snug text-ink-2">{linha.rotulo}</span>
            <div aria-hidden className="h-2 overflow-hidden rounded-full bg-sunken">
              <div className="h-full rounded-full bg-brand" style={{ width: `${(linha.n / total) * 100}%` }} />
            </div>
            <span className="text-right font-mono tabular-nums text-ink-2">
              {linha.n}
              <span className="ml-1.5 text-xs text-ink-muted">
                {formatarPorcentagem(linha.n / total, locale)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function IaVersusHumano({
  reclamacoes,
  comentarios,
  motivos,
}: {
  reclamacoes: RevisaoHumana;
  comentarios: RevisaoHumana;
  motivos: MotivosDeRevisao;
}) {
  const t = useTranslations("Estatisticas");
  return (
    <SecaoEstatistica id="humano" titulo={t("humanoTitulo")} descricao={t("humanoDescricao")}>
      <div className="grid gap-4 lg:grid-cols-2">
        <PainelRevisao revisao={reclamacoes} />
        <PainelRevisao revisao={comentarios} />
      </div>
      <MotivosDeRevisaoLista motivos={motivos} />
    </SecaoEstatistica>
  );
}
