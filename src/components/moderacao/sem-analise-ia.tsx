// Como as telas de moderação mostram um registro em que a IA NÃO analisou (ehFalhaDaIA, em
// lib/moderacao/falha). Sem isto, a nota 1 gravada como "lado seguro" aparecia como uma barra
// "Geral 1.00" cheia e vermelha, com a justificativa técnica, e parecia um veredito da IA.
import { useTranslations } from "next-intl";

import { Aviso } from "@/components/ui/aviso";
import { Etiqueta } from "@/components/ui/etiqueta";

// No lugar do painel de pontuações.
export function SemAnaliseIA() {
  const t = useTranslations("Moderacao");
  return <Aviso tom="atencao">{t("semAnaliseIA")}</Aviso>;
}

// No lugar do DecisaoBadge "(IA)": a decisão gravada nesse registro é só o destino seguro da
// falha, não uma decisão da IA.
export function EtiquetaSemAnaliseIA() {
  const t = useTranslations("Moderacao");
  return <Etiqueta tom="neutro">{t("origem_falha")}</Etiqueta>;
}
