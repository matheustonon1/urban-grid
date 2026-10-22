"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

import { SeletorCategoria } from "@/components/reclamacao/categoria-select";
import { SeletorCidade } from "@/components/formulario/cidade-combobox";
import { botaoPrimario, campoInput } from "@/lib/estilos";

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
    <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-line bg-sunken py-1 pr-1 pl-2.5 text-sm text-ink-2">
      <span className="truncate">{children}</span>
      <button
        type="button"
        onClick={onRemover}
        aria-label={ariaLabel}
        className="shrink-0 rounded-[3px] p-0.5 text-ink-muted hover:bg-line hover:text-ink"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </span>
  );
}

// Rótulo visível de um filtro. Nos dois seletores (cidade e categoria) o nome
// acessível do controle é o próprio valor/placeholder, então o rótulo é só um
// título acima: ligá-lo com `for` mudaria o nome do botão da categoria.
function RotuloFiltro({ children }: { children: React.ReactNode }) {
  return <span className="kicker">{children}</span>;
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
    <div className="flex flex-col gap-5 rounded-lg border border-line bg-surface p-5">
      <h2 className="kicker">{t("filtros")}</h2>

      <form className="flex flex-col gap-2" action="/reclamacoes">
        <label htmlFor="filtro-q" className="kicker">
          {t("rotuloBusca")}
        </label>
        <input
          id="filtro-q"
          type="text"
          name="q"
          defaultValue={buscaFiltro ?? ""}
          placeholder={t("buscarPalavraChave")}
          className={`w-full ${campoInput}`}
        />
        <button type="submit" className={`${botaoPrimario} w-full`}>
          {t("filtrar")}
        </button>
      </form>

      <div className="flex flex-col gap-2 border-t border-line pt-5">
        <RotuloFiltro>{t("rotuloCidade")}</RotuloFiltro>
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

      <div className="flex flex-col gap-2">
        <RotuloFiltro>{t("rotuloCategoria")}</RotuloFiltro>
        <SeletorCategoria
          categorias={categorias}
          selecionadaId={categoriaIdFiltro ?? null}
          placeholder={t("todasCategorias")}
          onSelecionar={(id) => navegar({ categoriaId: id })}
        />
      </div>

      {temFiltroAtivo && (
        <div className="flex flex-col gap-2.5 border-t border-line pt-5">
          <span className="kicker">{t("filtrosAtivos")}</span>
          <div className="flex flex-wrap items-center gap-2">
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
          </div>
          <Link href="/reclamacoes" className="w-fit text-sm font-medium text-brand underline underline-offset-2">
            {t("limpar")}
          </Link>
        </div>
      )}
    </div>
  );
}
