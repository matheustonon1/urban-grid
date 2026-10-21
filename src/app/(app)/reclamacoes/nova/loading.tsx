import { Esqueleto, EsqueletoCabecalho, EsqueletoPagina } from "@/components/esqueleto";
import { containerPagina } from "@/lib/estilos";

export default function Loading() {
  return (
    <EsqueletoPagina className={`${containerPagina} max-w-xl`}>
      <EsqueletoCabecalho comDescricao={false} />
      <Esqueleto className="h-[34rem] w-full rounded-lg" />
    </EsqueletoPagina>
  );
}
