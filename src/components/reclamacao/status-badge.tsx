import type { StatusReclamacao } from "@prisma/client";
import { useTranslations } from "next-intl";

// Pílula + ponto de cor. O texto sempre acompanha o ponto (cor nunca é o
// único portador do estado). EM_ANDAMENTO usa o laranja do acento do
// projeto - cor de obra/sinalização - pra não se confundir com
// AGUARDANDO_REVISAO, que continua âmbar. Escala slate (não gray) como o
// resto do site.
const ESTILO: Record<StatusReclamacao, string> = {
  RASCUNHO: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  EM_MODERACAO: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  AGUARDANDO_REVISAO: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  PUBLICADA: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  REJEITADA: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400",
  EM_ANDAMENTO: "bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  RESOLVIDA: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400",
  ARQUIVADA: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

// useTranslations funciona tanto em Server quanto em Client Components
// (next-intl resolve pra uma implementação diferente em cada ambiente
// por baixo dos panos) - não precisa de "use client" aqui.
export function StatusBadge({ status }: { status: StatusReclamacao }) {
  const t = useTranslations("Status");

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${ESTILO[status]}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {t(status)}
    </span>
  );
}
