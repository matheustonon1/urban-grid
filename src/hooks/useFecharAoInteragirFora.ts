"use client";

import { useEffect, useRef } from "react";

// Padrão repetido em todo popover/menu suspenso do site (seletor de
// idioma, seletor de categoria, combobox de cidade, sino de notificações,
// menu do usuário): fecha ao clicar fora ou apertar Escape. Um hook só,
// em vez de reescrever os dois listeners em cada componente.
//
// aoFechar vai numa ref (não na dependência do efeito) de propósito - os
// componentes que usam isto passam uma arrow function inline
// (`() => setAberto(false)`), que teria identidade nova a cada render;
// sem a ref, o efeito reatacharia os listeners em todo render em vez de
// só quando `aberto` muda.
export function useFecharAoInteragirFora<T extends HTMLElement>(
  aberto: boolean,
  aoFechar: () => void
) {
  const containerRef = useRef<T>(null);
  const aoFecharRef = useRef(aoFechar);

  // Atualiza a ref num efeito, não durante o render (mexer em ref.current
  // no corpo do componente é proibido pelas regras de hooks) - roda depois
  // de todo render, sem dependências, só pra manter a closure mais recente.
  useEffect(() => {
    aoFecharRef.current = aoFechar;
  });

  useEffect(() => {
    if (!aberto) return;

    function aoClicarFora(evento: MouseEvent) {
      if (!containerRef.current?.contains(evento.target as Node)) {
        aoFecharRef.current();
      }
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") aoFecharRef.current();
    }

    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  return containerRef;
}
