import { Esqueleto, EsqueletoCabecalho, EsqueletoPagina } from "@/components/ui/esqueleto";
import { pagina } from "@/lib/estilos";

export default function Loading() {
  return (
    <EsqueletoPagina className={pagina}>
      <EsqueletoCabecalho />
      <Esqueleto className="h-20 w-full rounded-lg" />
      <Esqueleto className="h-72 w-full rounded-lg" />
    </EsqueletoPagina>
  );
}
