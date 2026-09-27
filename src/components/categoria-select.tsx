"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { campoInput } from "@/lib/estilos";

import { CategoriaIcon } from "./categoria-icon";

interface Categoria {
  id: string;
  nome: string;
  icone: string | null;
}

// Popover próprio em vez do <select> nativo, pelo mesmo motivo do
// SeletorIdioma (components/seletor-idioma.tsx): o menu nativo do
// navegador destoa do resto da UI.
export function SeletorCategoria({
  name = "categoriaId",
  categorias,
  selecionadaId,
  placeholder,
  onSelecionar,
}: {
  name?: string;
  categorias: Categoria[];
  selecionadaId?: string | null;
  placeholder: string;
  onSelecionar?: (id: string | null) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function aoClicarFora(evento: MouseEvent) {
      if (!containerRef.current?.contains(evento.target as Node)) {
        setAberto(false);
      }
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, []);

  const selecionada = categorias.find((categoria) => categoria.id === selecionadaId) ?? null;

  function escolher(id: string | null) {
    setAberto(false);
    onSelecionar?.(id);
  }

  return (
    <div ref={containerRef} className="relative">
      <input type="hidden" name={name} value={selecionadaId ?? ""} />
      <button
        type="button"
        onClick={() => setAberto((valor) => !valor)}
        aria-haspopup="true"
        aria-expanded={aberto}
        className={`flex w-full items-center justify-between gap-2 text-left ${campoInput}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selecionada && (
            <CategoriaIcon
              icone={selecionada.icone}
              className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500"
            />
          )}
          <span className="truncate">{selecionada ? selecionada.nome : placeholder}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
      </button>

      {aberto && (
        <ul
          role="listbox"
          className="animate-pop-in absolute z-10 mt-1 max-h-72 w-full origin-top overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-md dark:border-slate-700 dark:bg-slate-900"
        >
          <li>
            <button
              type="button"
              role="option"
              aria-selected={!selecionadaId}
              onClick={() => escolher(null)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {placeholder}
              {!selecionadaId && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />}
            </button>
          </li>
          {categorias.map((categoria) => (
            <li key={categoria.id}>
              <button
                type="button"
                role="option"
                aria-selected={categoria.id === selecionadaId}
                onClick={() => escolher(categoria.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <CategoriaIcon
                  icone={categoria.icone}
                  className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500"
                />
                <span className="flex-1 truncate">{categoria.nome}</span>
                {categoria.id === selecionadaId && (
                  <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
