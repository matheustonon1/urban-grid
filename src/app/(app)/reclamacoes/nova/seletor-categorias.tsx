"use client";

import { CategoriaIcon } from "@/components/reclamacao/categoria-icon";

import { MensagemErro, idDica } from "@/components/formulario/campo";

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
      <legend className="mb-0.5 text-sm font-medium text-ink-2">
        {rotulo}
      </legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {categorias.map((categoria) => (
          <label
            key={categoria.id}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink-2 transition-colors hover:border-brand/60 hover:bg-brand-soft/50 has-checked:border-brand has-checked:bg-brand-soft has-checked:font-semibold has-checked:text-brand-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand"
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
              className="h-4.5 w-4.5 shrink-0 text-ink-muted"
            />
            <span className="min-w-0 leading-snug">{categoria.nome}</span>
          </label>
        ))}
      </div>
      {erro ? (
        <MensagemErro id={ID_GRUPO}>{erro}</MensagemErro>
      ) : (
        <p id={idDica(ID_GRUPO)} className="text-xs text-ink-muted">
          {dica}
        </p>
      )}
    </fieldset>
  );
}
