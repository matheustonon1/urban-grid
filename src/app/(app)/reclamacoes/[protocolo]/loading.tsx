import { Esqueleto, EsqueletoPagina } from "@/components/ui/esqueleto";
import { cartaoSecao, colunaLateral, colunaPrincipal, grade, pagina } from "@/lib/estilos";

// Mesma estrutura da página (cabeçalho + coluna principal + resumo lateral),
// pra nada pular de lugar quando o conteúdo chega.
export default function Loading() {
  return (
    <EsqueletoPagina className={pagina}>
      <div className="flex flex-col gap-4 border-b-2 border-line pb-6">
        <Esqueleto className="h-4 w-40" />
        <Esqueleto className="h-12 w-3/4" />
        <Esqueleto className="h-7 w-64" />
      </div>

      <div className={grade}>
        <div className={`${colunaLateral} lg:order-last ${cartaoSecao}`}>
          <Esqueleto className="h-4 w-20" />
          <Esqueleto className="h-10 w-full" />
          <Esqueleto className="h-4 w-2/3" />
          <Esqueleto className="h-4 w-1/2" />
          <Esqueleto className="h-4 w-1/3" />
          <Esqueleto className="h-10 w-full" />
        </div>

        <div className={colunaPrincipal}>
          <Esqueleto className="h-4 w-full" />
          <Esqueleto className="h-4 w-full" />
          <Esqueleto className="h-4 w-5/6" />
          <Esqueleto className="mt-4 h-40 w-full" />
        </div>
      </div>
    </EsqueletoPagina>
  );
}
