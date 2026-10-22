import type { StatusReclamacao } from "@prisma/client";
import { Check } from "lucide-react";
import { getTranslations } from "next-intl/server";

const ETAPAS = ["PUBLICADA", "EM_ANDAMENTO", "RESOLVIDA"] as const;

// Onde a reclamação está no caminho Publicada → Em andamento → Resolvida.
// Só faz sentido pra quem está nesse caminho: rejeitada, arquivada ou ainda
// em moderação não são "etapas" - nesses casos não desenha nada (o badge de
// status no cabeçalho já diz o estado).
export async function ProgressoStatus({ status }: { status: StatusReclamacao }) {
  const indiceAtual = (ETAPAS as readonly string[]).indexOf(status);
  if (indiceAtual === -1) return null;

  const t = await getTranslations("ReclamacaoDetalhe");
  const tStatus = await getTranslations("Status");
  const resolvida = status === "RESOLVIDA";

  return (
    <ol aria-label={t("progressoRotulo")} className="flex">
      {ETAPAS.map((etapa, i) => {
        const concluida = i < indiceAtual || resolvida;
        const atual = i === indiceAtual && !resolvida;
        const ultima = i === ETAPAS.length - 1;

        return (
          <li
            key={etapa}
            aria-current={atual ? "step" : undefined}
            className="relative flex flex-1 flex-col items-center gap-1.5 text-center"
          >
            {/* Trilho até a próxima etapa: cheio só se a próxima já foi alcançada. */}
            {!ultima && (
              <span
                aria-hidden
                className={`absolute top-3 left-1/2 h-0.5 w-full ${
                  i < indiceAtual ? "bg-brand" : "bg-line"
                }`}
              />
            )}
            <span
              aria-hidden
              className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                concluida
                  ? "border-brand bg-brand text-on-brand"
                  : atual
                    ? "border-brand bg-surface"
                    : "border-line-strong bg-surface"
              }`}
            >
              {concluida ? (
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              ) : atual ? (
                <span className="h-2 w-2 rounded-full bg-brand" />
              ) : null}
            </span>
            <span
              className={`text-xs ${
                concluida || atual
                  ? "font-medium text-ink"
                  : "text-ink-muted"
              }`}
            >
              {tStatus(etapa)}
              {concluida && <span className="sr-only"> ({t("etapaConcluida")})</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
