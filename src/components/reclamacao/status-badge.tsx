import type { StatusReclamacao } from "@prisma/client";
import { useTranslations } from "next-intl";

import { Etiqueta, type TomEtiqueta } from "@/components/ui/etiqueta";

// O texto sempre acompanha o ponto (cor nunca é o único portador do estado).
// EM_ANDAMENTO usa o laranja de obra pra não se confundir com
// AGUARDANDO_REVISAO, que é âmbar.
const TOM: Record<StatusReclamacao, TomEtiqueta> = {
  RASCUNHO: "neutro",
  EM_MODERACAO: "neutro",
  AGUARDANDO_REVISAO: "atencao",
  PUBLICADA: "info",
  REJEITADA: "erro",
  EM_ANDAMENTO: "andamento",
  RESOLVIDA: "sucesso",
  ARQUIVADA: "apagado",
};

// useTranslations funciona tanto em Server quanto em Client Components
// (next-intl resolve pra uma implementação diferente em cada ambiente
// por baixo dos panos) - não precisa de "use client" aqui.
export function StatusBadge({ status }: { status: StatusReclamacao }) {
  const t = useTranslations("Status");

  return <Etiqueta tom={TOM[status]}>{t(status)}</Etiqueta>;
}
