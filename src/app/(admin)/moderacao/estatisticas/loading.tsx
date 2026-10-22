import { Esqueleto, EsqueletoCabecalho, EsqueletoPagina } from "@/components/ui/esqueleto";
import { containerLargo } from "@/lib/estilos";

export default function Loading() {
  return (
    <EsqueletoPagina className={containerLargo}>
      <EsqueletoCabecalho />
      <Esqueleto className="h-28 w-full rounded-lg" />
      <Esqueleto className="h-44 w-full rounded-lg" />
      <Esqueleto className="h-80 w-full rounded-lg" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Esqueleto className="h-64 w-full rounded-lg" />
        <Esqueleto className="h-64 w-full rounded-lg" />
      </div>
    </EsqueletoPagina>
  );
}
