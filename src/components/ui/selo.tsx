import type { ReactNode } from "react";

import { Etiqueta, type TomEtiqueta } from "./etiqueta";

// Mesmos tons de sempre (sucesso/erro/atenção/info/neutro), agora sobre a
// Etiqueta: o Selo existe pra estados que não são de reclamação nem de decisão
// da IA (aprovada/rejeitada, inativo, papel...).
const TOM: Record<"sucesso" | "erro" | "atencao" | "info" | "neutro", TomEtiqueta> = {
  sucesso: "sucesso",
  erro: "erro",
  atencao: "atencao",
  info: "info",
  neutro: "neutro",
};

export function Selo({
  tom = "neutro",
  children,
}: {
  tom?: keyof typeof TOM;
  children: ReactNode;
}) {
  return <Etiqueta tom={TOM[tom]}>{children}</Etiqueta>;
}
