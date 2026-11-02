import type { DecisaoModeracao } from "@prisma/client";
import { useTranslations } from "next-intl";

import { Etiqueta, type TomEtiqueta } from "@/components/ui/etiqueta";

// Mesma linguagem do StatusBadge: verde aprova, âmbar manda pra revisão
// humana, vermelho reprova.
const TOM: Record<DecisaoModeracao, TomEtiqueta> = {
  APROVAR: "sucesso",
  REPROVAR: "erro",
  ENCAMINHAR_REVISAO: "atencao",
};

export function DecisaoBadge({
  decisao,
  origem,
}: {
  decisao: DecisaoModeracao;
  // Quem decidiu, entre parênteses ("IA", "humano"), quando importa.
  origem?: string;
}) {
  const t = useTranslations("Decisao");

  return (
    <Etiqueta tom={TOM[decisao]}>
      {t(decisao)}
      {origem && ` (${origem})`}
    </Etiqueta>
  );
}
