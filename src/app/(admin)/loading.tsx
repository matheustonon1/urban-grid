import { EsqueletoListaGenerica } from "@/components/ui/esqueleto";
import { containerPagina } from "@/lib/estilos";

export default function Loading() {
  return <EsqueletoListaGenerica container={`${containerPagina} max-w-3xl`} />;
}
