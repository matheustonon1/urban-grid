"use client";

import { useEffect, useRef, useState } from "react";

// Fade + leve deslocamento pra cima quando o elemento entra na tela -
// dispara uma vez só (nunca repete ao rolar de volta), pra não virar
// irritante em quem sobe e desce a página. Some inteiramente se o
// usuário preferir menos movimento.
export function Revelar({
  children,
  atraso = 0,
  className = "",
}: {
  children: React.ReactNode;
  atraso?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Inicializa já visível se o usuário preferir menos movimento - evita
  // precisar de um setState síncrono dentro do effect só pra esse caso.
  const [visivel, setVisivel] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    if (visivel) return;

    const elemento = ref.current;
    if (!elemento) return;

    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          setVisivel(true);
          observador.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    observador.observe(elemento);
    return () => observador.disconnect();
  }, [visivel]);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: visivel ? `${atraso}ms` : "0ms" }}
      className={`transition-all duration-700 ease-out ${
        visivel ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}
