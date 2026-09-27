"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { SeletorCategoria } from "@/components/categoria-select";
import { SeletorCidade } from "@/components/cidade-combobox";
import { botaoPrimario, campoInput, cartao } from "@/lib/estilos";

interface Categoria {
  id: string;
  nome: string;
  icone: string | null;
}

interface CidadeFiltro {
  id: string;
  nome: string;
  slug: string;
  estado: { uf: string };
}

function Chip({
  children,
  onRemover,
  ariaLabel,
}: {
  children: React.ReactNode;
  onRemover: () => void;
  ariaLabel: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-1 pl-2.5 pr-1 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
      {children}
      <button
        type="button"
        onClick={onRemover}
        aria-label={ariaLabel}
        className="rounded-full p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700"
      >
        <X className="h-3 w-3" aria-hidden />
      </button>
    </span>
  );
}

// Cidade e categoria aplicam o filtro assim que escolhidas (navegação
// client-side, sem precisar clicar em "Filtrar") - só a busca por palavra-
// chave depende do botão, pra não disparar uma navegação a cada tecla.
export function FiltroReclamacoes({
  categorias,
  categoriaIdFiltro,
  cidadeFiltro,
  buscaFiltro,
}: {
  categorias: Categoria[];
  categoriaIdFiltro?: string;
  cidadeFiltro?: CidadeFiltro | null;
  buscaFiltro?: string;
}) {
  const t = useTranslations("Reclamacoes");
  const router = useRouter();
  const categoriaFiltro = categorias.find((categoria) => categoria.id === categoriaIdFiltro);

  function navegar(mudancas: Record<string, string | null>) {
    const params = new URLSearchParams();
    if (buscaFiltro) params.set("q", buscaFiltro);
    if (cidadeFiltro) params.set("cidadeId", cidadeFiltro.id);
    if (categoriaIdFiltro) params.set("categoriaId", categoriaIdFiltro);
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor) params.set(chave, valor);
      else params.delete(chave);
    }
    const query = params.toString();
    router.push(query ? `/reclamacoes?${query}` : "/reclamacoes");
  }

  const temFiltroAtivo = Boolean(cidadeFiltro || categoriaFiltro || buscaFiltro);

  return (
    <div className={`flex flex-col gap-3 ${cartao}`}>
      <form className="flex flex-col gap-3" action="/reclamacoes">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
              aria-hidden
            />
            <input
              type="text"
              name="q"
              defaultValue={buscaFiltro ?? ""}
              placeholder={t("buscarPalavraChave")}
              className={`w-full pl-9 ${campoInput}`}
            />
          </div>
          <button type="submit" className={botaoPrimario}>
            {t("filtrar")}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="min-w-48 flex-1">
            <SeletorCidade
              key={cidadeFiltro?.id ?? "sem-cidade"}
              placeholder={t("buscarCidadeEstado")}
              defaultValue={
                cidadeFiltro
                  ? { id: cidadeFiltro.id, nome: cidadeFiltro.nome, uf: cidadeFiltro.estado.uf }
                  : null
              }
              onSelecionar={(cidade) => navegar({ cidadeId: cidade.id })}
            />
          </div>
          <div className="min-w-48 flex-1">
            <SeletorCategoria
              categorias={categorias}
              selecionadaId={categoriaIdFiltro ?? null}
              placeholder={t("todasCategorias")}
              onSelecionar={(id) => navegar({ categoriaId: id })}
            />
          </div>
        </div>
      </form>

      {temFiltroAtivo && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <span>{t("filtrosAtivos")}</span>
          {buscaFiltro && (
            <Chip ariaLabel={t("removerFiltro", { filtro: buscaFiltro })} onRemover={() => navegar({ q: null })}>
              &quot;{buscaFiltro}&quot;
            </Chip>
          )}
          {categoriaFiltro && (
            <Chip
              ariaLabel={t("removerFiltro", { filtro: categoriaFiltro.nome })}
              onRemover={() => navegar({ categoriaId: null })}
            >
              {categoriaFiltro.nome}
            </Chip>
          )}
          {cidadeFiltro && (
            <Chip
              ariaLabel={t("removerFiltro", {
                filtro: `${cidadeFiltro.nome} - ${cidadeFiltro.estado.uf}`,
              })}
              onRemover={() => navegar({ cidadeId: null })}
            >
              <Link href={`/cidades/${cidadeFiltro.slug}`} className="hover:underline">
                {cidadeFiltro.nome} - {cidadeFiltro.estado.uf}
              </Link>
            </Chip>
          )}
          <Link href="/reclamacoes" className="text-primary underline">
            {t("limpar")}
          </Link>
        </div>
      )}
    </div>
  );
}
