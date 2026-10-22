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
  // Sempre false na primeira renderização, tanto no servidor quanto no
  // cliente - window não existe no servidor, então decidir isso já no
  // valor inicial do useState faz o cliente hidratar com um resultado
  // diferente do HTML que veio do servidor (erro de hidratação). O valor
  // real só muda depois de montar, no effect abaixo.
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
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
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: visivel ? `${atraso}ms` : "0ms" }}
      // motion-reduce: força opacidade/posição final e desliga a transição
      // via CSS puro, ativo desde o primeiro pixel renderizado - não
      // depende do JS rodar primeiro (diferente de checar matchMedia no
      // effect, que ainda deixaria a transição de 700ms tocar, só que
      // mais cedo).
      className={`motion-reduce:transition-none motion-reduce:translate-y-0 motion-reduce:opacity-100 transition-all duration-700 ease-out ${
        visivel ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}
