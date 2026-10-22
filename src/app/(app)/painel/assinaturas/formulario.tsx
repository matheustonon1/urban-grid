"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { SeletorCategoria } from "@/components/reclamacao/categoria-select";
import { SeletorCidade } from "@/components/formulario/cidade-combobox";
import { Campo } from "@/components/formulario/campo";
import { Aviso } from "@/components/ui/aviso";
import { botaoPrimario, cartaoSecao } from "@/lib/estilos";

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
    <form action={action} className={`flex flex-col gap-5 ${cartaoSecao}`}>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-xl font-extrabold tracking-tight text-ink">{t("nova")}</h2>
        <p className="text-sm text-ink-muted">{t("novaDescricao")}</p>
      </div>

      <Campo id="assinatura-cidade" rotulo={t("cidade")}>
        <SeletorCidade
          key={resetKey}
          id="assinatura-cidade"
          name="cidadeId"
          placeholder={t("cidade")}
          required
        />
      </Campo>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink-2">{t("rotuloCategoria")}</span>
        <SeletorCategoria
          categorias={categorias}
          selecionadaId={categoriaId}
          placeholder={t("todasCategorias")}
          onSelecionar={setCategoriaId}
        />
      </div>

      {state?.erro && <Aviso tom="erro">{state.erro}</Aviso>}

      <button type="submit" disabled={pending} className={`${botaoPrimario} w-full`}>
        {t("assinar")}
      </button>
    </form>
  );
}
