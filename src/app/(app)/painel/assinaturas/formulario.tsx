"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { SeletorCategoria } from "@/components/categoria-select";
import { SeletorCidade } from "@/components/cidade-combobox";
import { botaoPrimario, cartao } from "@/lib/estilos";

import { criarAssinatura } from "./actions";

interface Categoria {
  id: string;
  nome: string;
  icone: string | null;
}

export function FormularioNovaAssinatura({ categorias }: { categorias: Categoria[] }) {
  const t = useTranslations("Assinaturas");
  const [state, action, pending] = useActionState(criarAssinatura, undefined);
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const eraPendente = useRef(false);

  // Limpa o formulário só depois de um envio bem-sucedido (pending caiu
  // pra false sem erro) - remontar em caso de erro perderia o que a
  // pessoa já tinha preenchido, junto com a própria mensagem de erro.
  useEffect(() => {
    if (eraPendente.current && !pending && !state?.erro) {
      setCategoriaId(null);
      setResetKey((chave) => chave + 1);
    }
    eraPendente.current = pending;
  }, [pending, state]);

  return (
    <form action={action} className={`flex flex-col gap-3 ${cartao}`}>
      <h2 className="font-semibold text-slate-900 dark:text-slate-100">{t("nova")}</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">{t("novaDescricao")}</p>

      <div className="flex flex-wrap gap-2">
        <div className="min-w-48 flex-1">
          <SeletorCidade key={resetKey} name="cidadeId" placeholder={t("cidade")} required />
        </div>
        <div className="min-w-48 flex-1">
          <SeletorCategoria
            categorias={categorias}
            selecionadaId={categoriaId}
            placeholder={t("todasCategorias")}
            onSelecionar={setCategoriaId}
          />
        </div>
      </div>

      {state?.erro && <p className="text-sm text-red-600 dark:text-red-400">{state.erro}</p>}

      <button type="submit" disabled={pending} className={`${botaoPrimario} w-fit`}>
        {t("assinar")}
      </button>
    </form>
  );
}
