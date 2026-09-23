import type { StatusReclamacao } from "@prisma/client";
import { useTranslations } from "next-intl";

const CLASSNAME: Record<StatusReclamacao, string> = {
  RASCUNHO: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  EM_MODERACAO: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  AGUARDANDO_REVISAO: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  PUBLICADA: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  REJEITADA: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400",
  EM_ANDAMENTO: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  RESOLVIDA: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400",
  ARQUIVADA: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

// useTranslations funciona tanto em Server quanto em Client Components
// (next-intl resolve pra uma implementação diferente em cada ambiente
// por baixo dos panos) - não precisa de "use client" aqui.
export function StatusBadge({ status }: { status: StatusReclamacao }) {
  const t = useTranslations("Status");

  return (
    <span
      className={`inline-block shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${CLASSNAME[status]}`}
    >
      {t(status)}
    </span>
  );
}
