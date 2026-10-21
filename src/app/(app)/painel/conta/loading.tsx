import { EsqueletoListaGenerica } from "@/components/esqueleto";
import { containerPagina } from "@/lib/estilos";

export default function Loading() {
  return <EsqueletoListaGenerica container={`${containerPagina} max-w-4xl`} quantidade={3} />;
}
