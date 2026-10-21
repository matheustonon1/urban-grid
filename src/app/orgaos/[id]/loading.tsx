import { EsqueletoListaGenerica } from "@/components/esqueleto";
import { containerMedio } from "@/lib/estilos";

export default function Loading() {
  return <EsqueletoListaGenerica container={containerMedio} comNumeros quantidade={3} />;
}
