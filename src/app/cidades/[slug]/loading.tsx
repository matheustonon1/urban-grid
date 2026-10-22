import { Esqueleto, EsqueletoCartoes, EsqueletoCabecalho, EsqueletoPagina } from "@/components/ui/esqueleto";
import { containerMedio } from "@/lib/estilos";

export default function Loading() {
  return (
    <EsqueletoPagina className={`${containerMedio} gap-8`}>
      <EsqueletoCabecalho />
      <Esqueleto className="h-44 w-full rounded-xl" />
      <Esqueleto className="h-48 w-full rounded-xl" />
      <EsqueletoCartoes quantidade={3} />
    </EsqueletoPagina>
  );
}
