import { getTranslations } from "next-intl/server";

import { cartao } from "@/lib/estilos";

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
    <div className="flex flex-col gap-2">
      <Esqueleto className="h-8 w-56" />
      {comDescricao && <Esqueleto className="h-4 w-80 max-w-full" />}
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

// Esqueleto genérico de página de lista: cabeçalho, faixa de números
// opcional e cartões. `container` é a MESMA classe de largura que a página
// real usa - é o que impede o conteúdo de "pular" de largura ao chegar.
export function EsqueletoListaGenerica({
  container,
  comNumeros = false,
  quantidade = 4,
}: {
  container: string;
  comNumeros?: boolean;
  quantidade?: number;
}) {
  return (
    <EsqueletoPagina className={container}>
      <EsqueletoCabecalho />
      {comNumeros && <Esqueleto className="h-20 w-full rounded-lg" />}
      <EsqueletoCartoes quantidade={quantidade} />
    </EsqueletoPagina>
  );
}
