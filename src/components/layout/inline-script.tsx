"use client";

// <script> inline que roda durante o parse do HTML, antes da primeira pintura (usado para aplicar
// o tema salvo sem piscar). Padrão do guia "Preventing Flash" do Next.
//
// Por que um Client Component e por que o `type` muda:
// - No servidor (SSR) sai `text/javascript` e o navegador o executa ao ler o HTML.
// - Quando o React recria o elemento no navegador (hidratação, ou o layout raiz renderizado de novo
//   a partir do payload RSC depois de um `router.refresh()`), scripts criados assim nunca executam,
//   e o React 19 avisa no console em desenvolvimento ("Encountered a script tag while rendering
//   React component"). Com `type="text/plain"` o elemento é um bloco de dados: sem aviso e sem
//   nada a executar.
// - `suppressHydrationWarning` aceita a diferença de `type` entre o HTML do servidor e o cliente.
//
// A CSP (`next.config.ts`) já libera script inline em `script-src` por causa deste uso.
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
