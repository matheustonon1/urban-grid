import { useLocale, useTranslations } from "next-intl";

import { cartaoSecao } from "@/lib/estilos";
import {
  LIMITE_REPROVACAO,
  LIMITE_REPROVACAO_COMENTARIO,
  LIMITE_REVISAO,
} from "@/lib/moderacao/pontuacoes";

// Legenda das barras de pontuação, com os cortes de verdade do pipeline (a
// mesma fonte que colore as barras): quem modera não precisa decorar o que o
// âmbar e o vermelho querem dizer. Comentário não tem faixa de revisão - só
// passa ou reprova.
export function GuiaPontuacoes({ comentario = false }: { comentario?: boolean }) {
  const t = useTranslations("Moderacao");
  const locale = useLocale();
  const limite = (valor: number) =>
    valor.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const faixas = comentario
    ? [
        { cor: "bg-ink-faint", texto: t("guiaOk", { limite: limite(LIMITE_REPROVACAO_COMENTARIO) }) },
        { cor: "bg-danger-ink", texto: t("guiaReprova", { limite: limite(LIMITE_REPROVACAO_COMENTARIO) }) },
      ]
    : [
        { cor: "bg-ink-faint", texto: t("guiaOk", { limite: limite(LIMITE_REVISAO) }) },
        { cor: "bg-warn-ink", texto: t("guiaRevisao", { limite: limite(LIMITE_REVISAO) }) },
        { cor: "bg-danger-ink", texto: t("guiaReprova", { limite: limite(LIMITE_REPROVACAO) }) },
      ];

  return (
    <div className={`flex flex-col gap-4 ${cartaoSecao}`}>
      <span className="kicker">{t("guiaTitulo")}</span>
      <ul className="flex flex-col gap-2.5">
        {faixas.map((faixa) => (
          <li key={faixa.texto} className="flex items-center gap-3 text-sm text-ink-2">
            <span aria-hidden className={`h-1.5 w-8 shrink-0 rounded-full ${faixa.cor}`} />
            {faixa.texto}
          </li>
        ))}
      </ul>
    </div>
  );
}
