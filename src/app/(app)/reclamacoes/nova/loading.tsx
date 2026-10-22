import { Esqueleto, EsqueletoCabecalho, EsqueletoPagina } from "@/components/ui/esqueleto";
import { containerLargo } from "@/lib/estilos";

export default function Loading() {
  return (
    <EsqueletoPagina className={containerLargo}>
      <EsqueletoCabecalho />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="flex flex-col gap-5">
          <Esqueleto className="h-80 w-full rounded-xl" />
          <Esqueleto className="h-72 w-full rounded-xl" />
        </div>
        <Esqueleto className="hidden h-96 w-full rounded-xl lg:block" />
      </div>
    </EsqueletoPagina>
  );
}
