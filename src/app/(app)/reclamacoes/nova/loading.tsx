import { Esqueleto, EsqueletoCabecalho, EsqueletoPagina } from "@/components/ui/esqueleto";
import { pagina } from "@/lib/estilos";

export default function Loading() {
  return (
    <EsqueletoPagina className={pagina}>
      <EsqueletoCabecalho />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-5">
          <Esqueleto className="h-80 w-full rounded-lg" />
          <Esqueleto className="h-72 w-full rounded-lg" />
        </div>
        <Esqueleto className="hidden h-96 w-full rounded-lg lg:block" />
      </div>
    </EsqueletoPagina>
  );
}
