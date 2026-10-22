import { Esqueleto, EsqueletoCartoes, EsqueletoCabecalho, EsqueletoPagina } from "@/components/ui/esqueleto";
import { containerMedio } from "@/lib/estilos";

export default function Loading() {
  return (
    <EsqueletoPagina className={containerMedio}>
      <EsqueletoCabecalho />
      <Esqueleto className="h-32 w-full rounded-xl" />
      <EsqueletoCartoes quantidade={5} />
    </EsqueletoPagina>
  );
}
