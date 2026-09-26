"use client";

import { useEffect, useId, useRef, useState } from "react";

import { campoInput } from "@/lib/estilos";

interface CidadeResultado {
  id: string;
  nome: string;
  uf: string;
  slug?: string;
  estadoNome?: string;
}

function formatar(cidade: CidadeResultado) {
  return `${cidade.nome} - ${cidade.uf}`;
}

export function SeletorCidade({
  name = "cidadeId",
  defaultValue = null,
  placeholder = "Cidade",
  required = false,
  onSelecionar,
}: {
  name?: string;
  defaultValue?: CidadeResultado | null;
  placeholder?: string;
  required?: boolean;
  onSelecionar?: (cidade: CidadeResultado) => void;
}) {
  const [query, setQuery] = useState(
    defaultValue ? formatar(defaultValue) : ""
  );
  const [selecionada, setSelecionada] = useState<CidadeResultado | null>(
    defaultValue
  );
  const [resultados, setResultados] = useState<CidadeResultado[]>([]);
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const [indiceAtivo, setIndiceAtivo] = useState(-1);

  function selecionar(cidade: CidadeResultado) {
    setSelecionada(cidade);
    setQuery(formatar(cidade));
    setResultados([]);
    setAberto(false);
    setIndiceAtivo(-1);
    onSelecionar?.(cidade);
  }

  function aoTeclar(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "Escape") {
      setAberto(false);
      return;
    }
    if (!aberto || resultados.length === 0) return;

    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      setIndiceAtivo((atual) => (atual + 1) % resultados.length);
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setIndiceAtivo((atual) =>
        atual <= 0 ? resultados.length - 1 : atual - 1
      );
    } else if (evento.key === "Enter" && indiceAtivo >= 0) {
      evento.preventDefault();
      selecionar(resultados[indiceAtivo]);
    }
  }

  useEffect(() => {
    function aoClicarFora(evento: MouseEvent) {
      if (!containerRef.current?.contains(evento.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  useEffect(() => {
    if (selecionada && query === formatar(selecionada)) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (query.trim().length < 2) {
        setResultados([]);
        return;
      }

      try {
        const resposta = await fetch(
          `/api/cidades?q=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        );
        const dados: CidadeResultado[] = await resposta.json();
        setResultados(dados);
        setIndiceAtivo(-1);
      } catch (erro) {
        if ((erro as Error).name !== "AbortError") {
          setResultados([]);
        }
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, selecionada]);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={aberto}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-label={placeholder}
        aria-activedescendant={
          aberto && indiceAtivo >= 0
            ? `${listboxId}-${resultados[indiceAtivo]?.id}`
            : undefined
        }
        onKeyDown={aoTeclar}
        value={query}
        placeholder={required ? `${placeholder} *` : placeholder}
        onChange={(evento) => {
          setQuery(evento.target.value);
          setSelecionada(null);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        className={`w-full ${campoInput}`}
      />
      <input type="hidden" name={name} value={selecionada?.id ?? ""} />

      {aberto && resultados.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="animate-pop-in absolute z-10 mt-1 max-h-60 w-full origin-top overflow-auto rounded-lg border border-slate-200 bg-white shadow-md dark:border-slate-700 dark:bg-slate-900"
        >
          {resultados.map((cidade, indice) => {
            const novoGrupo = cidade.estadoNome !== resultados[indice - 1]?.estadoNome;

            return (
              <li key={cidade.id}>
                {novoGrupo && cidade.estadoNome && (
                  <p
                    role="presentation"
                    className="bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                  >
                    {cidade.estadoNome}
                  </p>
                )}
                <button
                  type="button"
                  role="option"
                  id={`${listboxId}-${cidade.id}`}
                  tabIndex={-1}
                  aria-selected={selecionada?.id === cidade.id}
                  onClick={() => selecionar(cidade)}
                  className={`block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 ${
                    indice === indiceAtivo ? "bg-slate-100 dark:bg-slate-800" : ""
                  }`}
                >
                  {formatar(cidade)}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
