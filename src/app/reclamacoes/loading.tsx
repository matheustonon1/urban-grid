import { Esqueleto, EsqueletoCartoes, EsqueletoCabecalho, EsqueletoPagina } from "@/components/ui/esqueleto";
import { colunaFiltros, colunaResultados, grade, pagina } from "@/lib/estilos";

export default function Loading() {
  return (
    <EsqueletoPagina className={pagina}>
      <EsqueletoCabecalho />
      <div className={grade}>
        <div className={colunaFiltros}>
          <Esqueleto className="h-80 w-full rounded-lg" />
        </div>
        <div className={colunaResultados}>
          <EsqueletoCartoes quantidade={5} />
        </div>
      </div>
    </EsqueletoPagina>
  );
}
