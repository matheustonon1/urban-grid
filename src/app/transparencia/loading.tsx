import { Esqueleto, EsqueletoCabecalho, EsqueletoPagina } from "@/components/ui/esqueleto";
import { containerLargo } from "@/lib/estilos";

export default function Loading() {
  return (
    <EsqueletoPagina className={containerLargo}>
      <EsqueletoCabecalho />
      <Esqueleto className="h-20 w-full rounded-lg" />
      <Esqueleto className="h-72 w-full rounded-lg" />
    </EsqueletoPagina>
  );
}
