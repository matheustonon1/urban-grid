"use client";

import { CategoriaIcon } from "@/components/reclamacao/categoria-icon";

import { MensagemErro, idDica } from "./campo";

interface Categoria {
  id: string;
  nome: string;
  icone: string | null;
}

const ID_GRUPO = "nova-categoria";

// Categorias como opções à vista, em vez de um menu suspenso: são poucas
// (cabem na tela), a pessoa compara todas de uma vez e o ícone ajuda a
// reconhecer. É um grupo de <input type="radio"> de verdade (setas do teclado,
// leitor de tela e envio do formulário de graça); o rótulo inteiro é o alvo
// do clique.
export function SeletorCategorias({
  categorias,
  selecionadaId,
  onSelecionar,
  rotulo,
  dica,
  erro,
}: {
  categorias: Categoria[];
  selecionadaId: string;
  onSelecionar: (id: string) => void;
  rotulo: string;
  dica: string;
  erro?: string;
}) {
  return (
    <fieldset
      // aria-invalid não vale para um <input type="radio"> sozinho; o grupo
      // marca o erro aqui e o foco pós-envio (form.tsx) procura por isto.
      data-invalido={erro ? "true" : undefined}
      aria-describedby={erro ? `${ID_GRUPO}-erro` : idDica(ID_GRUPO)}
      className="flex min-w-0 flex-col gap-2"
    >
      <legend className="mb-0.5 text-sm font-medium text-slate-800 dark:text-slate-200">
        {rotulo}
      </legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {categorias.map((categoria) => (
          <label
            key={categoria.id}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50/50 has-checked:border-blue-600 has-checked:bg-blue-50 has-checked:font-medium has-checked:text-blue-900 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-500/60 dark:hover:bg-blue-500/5 dark:has-checked:border-blue-400 dark:has-checked:bg-blue-500/10 dark:has-checked:text-blue-200"
          >
            <input
              type="radio"
              name="categoriaId"
              value={categoria.id}
              checked={selecionadaId === categoria.id}
              onChange={() => onSelecionar(categoria.id)}
              className="sr-only"
            />
            <CategoriaIcon
              icone={categoria.icone}
              className="h-4.5 w-4.5 shrink-0 text-slate-400 dark:text-slate-500"
            />
            <span className="min-w-0 leading-snug">{categoria.nome}</span>
          </label>
        ))}
      </div>
      {erro ? (
        <MensagemErro id={ID_GRUPO}>{erro}</MensagemErro>
      ) : (
        <p id={idDica(ID_GRUPO)} className="text-xs text-slate-500 dark:text-slate-400">
          {dica}
        </p>
      )}
    </fieldset>
  );
}
