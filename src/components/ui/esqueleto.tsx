import { getTranslations } from "next-intl/server";

import { cartao, colunaLateral, colunaPrincipal, grade, pagina } from "@/lib/estilos";

// Bloco cinza pulsante - o "esqueleto" do que vai aparecer. A animação some
// com prefers-reduced-motion (motion-reduce:), sem depender de lista manual
// em globals.css: é utilitário do Tailwind, não uma classe .animate-* nossa.
export function Esqueleto({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-md bg-sunken motion-reduce:animate-none ${className}`}
    />
  );
}

// Moldura de todo loading.tsx: anuncia "Carregando" pra leitor de tela
// (role=status) e mantém o mesmo container das páginas de verdade, pra
// nada pular de lugar quando o conteúdo chega. É um <div>, não um <main>:
// na troca de rota o esqueleto e a página de verdade coexistem por um
// instante, e dois landmarks main são inválidos (e quebram quem seleciona
// por "main").
export async function EsqueletoPagina({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  const t = await getTranslations("Comum");

  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{t("carregando")}</span>
      {children}
    </div>
  );
}

export function EsqueletoCabecalho({ comDescricao = true }: { comDescricao?: boolean }) {
  return (
    <div className="flex flex-col gap-3 border-b-2 border-line pb-6">
      <Esqueleto className="h-10 w-72 max-w-full" />
      {comDescricao && <Esqueleto className="h-5 w-96 max-w-full" />}
    </div>
  );
}

// Um cartão de lista (título + meta + estatística), no mesmo formato de
// CartaoReclamacao.
export function EsqueletoCartao() {
  return (
    <div className={`flex flex-col gap-3 ${cartao}`}>
      <Esqueleto className="h-5 w-3/4" />
      <Esqueleto className="h-4 w-1/2" />
      <Esqueleto className="h-4 w-1/4" />
    </div>
  );
}

export function EsqueletoCartoes({ quantidade = 5 }: { quantidade?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: quantidade }, (_, i) => (
        <EsqueletoCartao key={i} />
      ))}
    </div>
  );
}

// Régua + título de uma `Secao`, ainda sem conteúdo.
export function EsqueletoSecao() {
  return (
    <div className="border-b-2 border-line pb-2.5">
      <Esqueleto className="h-6 w-48 max-w-full" />
    </div>
  );
}

// Esqueleto genérico de página de lista: cabeçalho, uma seção com cartões e,
// por padrão, a coluna lateral (8 + 4, a mesma grade das páginas de verdade -
// é o que impede o conteúdo de "pular" de largura ao chegar).
export function EsqueletoListaGenerica({
  lateral = true,
  quantidade = 4,
}: {
  lateral?: boolean;
  quantidade?: number;
}) {
  return (
    <EsqueletoPagina className={pagina}>
      <EsqueletoCabecalho />
      <div className={grade}>
        <div className={colunaPrincipal}>
          <EsqueletoSecao />
          <EsqueletoCartoes quantidade={quantidade} />
        </div>
        {lateral && (
          <div className={colunaLateral}>
            <Esqueleto className="h-56 w-full rounded-lg" />
          </div>
        )}
      </div>
    </EsqueletoPagina>
  );
}
