import { Esqueleto, EsqueletoCartoes, EsqueletoCabecalho, EsqueletoPagina } from "@/components/ui/esqueleto";
import { colunaPrincipal, grade, pagina } from "@/lib/estilos";

export default function Loading() {
  return (
    <EsqueletoPagina className={pagina}>
      <EsqueletoCabecalho />
      <Esqueleto className="h-40 w-full rounded-lg" />
      <div className={grade}>
        <div className={colunaPrincipal}>
          <EsqueletoCartoes quantidade={3} />
        </div>
        <div className="flex flex-col gap-6 lg:col-span-4">
          <Esqueleto className="h-48 w-full rounded-lg" />
          <Esqueleto className="h-40 w-full rounded-lg" />
        </div>
      </div>
    </EsqueletoPagina>
  );
}
