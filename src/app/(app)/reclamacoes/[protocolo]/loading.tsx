import { Esqueleto, EsqueletoPagina } from "@/components/esqueleto";
import { cartao, containerLargo } from "@/lib/estilos";

// Mesma estrutura da página (cabeçalho + coluna principal + resumo lateral),
// pra nada pular de lugar quando o conteúdo chega.
export default function Loading() {
  return (
    <EsqueletoPagina className={containerLargo}>
      <div className="flex flex-col gap-3">
        <Esqueleto className="h-4 w-40" />
        <Esqueleto className="h-9 w-3/4" />
        <Esqueleto className="h-6 w-56" />
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className={`flex flex-col gap-5 lg:order-last ${cartao}`}>
          <Esqueleto className="h-4 w-20" />
          <Esqueleto className="h-10 w-full" />
          <Esqueleto className="h-4 w-2/3" />
          <Esqueleto className="h-4 w-1/2" />
          <Esqueleto className="h-4 w-1/3" />
          <Esqueleto className="h-10 w-full" />
        </div>

        <div className="flex flex-col gap-3">
          <Esqueleto className="h-4 w-full" />
          <Esqueleto className="h-4 w-full" />
          <Esqueleto className="h-4 w-5/6" />
          <Esqueleto className="mt-4 h-40 w-full" />
        </div>
      </div>
    </EsqueletoPagina>
  );
}
