import { EsqueletoListaGenerica } from "@/components/ui/esqueleto";
import { containerMedio } from "@/lib/estilos";

export default function Loading() {
  return <EsqueletoListaGenerica container={containerMedio} comNumeros quantidade={3} />;
}
