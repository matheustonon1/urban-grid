import { Esqueleto, EsqueletoCabecalho, EsqueletoPagina, EsqueletoSecao } from "@/components/ui/esqueleto";
import { pagina } from "@/lib/estilos";

export default function Loading() {
  return (
    <EsqueletoPagina className={pagina}>
      <EsqueletoCabecalho />
      <Esqueleto className="h-28 w-full rounded-lg" />
      <div className="flex flex-col gap-5">
        <EsqueletoSecao />
        <Esqueleto className="h-44 w-full rounded-lg" />
      </div>
      <div className="flex flex-col gap-5">
        <EsqueletoSecao />
        <Esqueleto className="h-80 w-full rounded-lg" />
      </div>
      <div className="grid gap-10 lg:grid-cols-2">
        <Esqueleto className="h-64 w-full rounded-lg" />
        <Esqueleto className="h-64 w-full rounded-lg" />
      </div>
    </EsqueletoPagina>
  );
}
