"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { botaoPrimario, campoInput, cartaoDestaque } from "@/lib/estilos";

import { solicitarRedefinicaoSenha } from "./actions";

export function FormularioEsqueciSenha() {
  const t = useTranslations("EsqueciSenha");
  const [state, action, pending] = useActionState(solicitarRedefinicaoSenha, undefined);

  return (
    <form action={action} className={`flex flex-col gap-3 ${cartaoDestaque}`}>
      <input
        type="email"
        name="email"
        placeholder={t("emailPlaceholder")}
        required
        className={campoInput}
      />
      {state?.erros?.email && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.erros.email[0]}</p>
      )}

      {state?.mensagem && (
        <p className="text-sm text-slate-600 dark:text-slate-400">{state.mensagem}</p>
      )}

      <button type="submit" disabled={pending} className={botaoPrimario}>
        {t("enviarLink")}
      </button>
    </form>
  );
}
