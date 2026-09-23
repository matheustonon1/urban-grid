"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { botaoPrimario, campoInput, cartao } from "@/lib/estilos";

import { redefinirSenha } from "./actions";

export function FormularioRedefinirSenha({ token }: { token: string }) {
  const t = useTranslations("RedefinirSenha");
  const acaoComToken = redefinirSenha.bind(null, token);
  const [state, action, pending] = useActionState(acaoComToken, undefined);

  return (
    <form action={action} className={`flex w-full max-w-sm flex-col gap-3 ${cartao}`}>
      <input
        type="password"
        name="senha"
        placeholder={t("novaSenha")}
        className={campoInput}
      />
      {state?.erros?.senha && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.erros.senha[0]}</p>
      )}

      <input
        type="password"
        name="confirmarSenha"
        placeholder={t("confirmeNovaSenha")}
        className={campoInput}
      />
      {state?.erros?.confirmarSenha && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {state.erros.confirmarSenha[0]}
        </p>
      )}

      {state?.mensagem && (
        <p className="text-sm text-slate-600 dark:text-slate-400">{state.mensagem}</p>
      )}

      <button type="submit" disabled={pending} className={botaoPrimario}>
        {t("redefinirEEntrar")}
      </button>
    </form>
  );
}
