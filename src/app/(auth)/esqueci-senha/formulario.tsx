"use client";

import { useActionState } from "react";

import { botaoPrimario, campoInput, cartaoDestaque } from "@/lib/estilos";

import { solicitarRedefinicaoSenha } from "./actions";

export function FormularioEsqueciSenha() {
  const [state, action, pending] = useActionState(solicitarRedefinicaoSenha, undefined);

  return (
    <form action={action} className={`flex flex-col gap-3 ${cartaoDestaque}`}>
      <input
        type="email"
        name="email"
        placeholder="Seu e-mail cadastrado"
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
        Enviar link de redefinição
      </button>
    </form>
  );
}
