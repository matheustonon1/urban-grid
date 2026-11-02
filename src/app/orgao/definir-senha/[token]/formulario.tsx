"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Campo, descritoPor } from "@/components/formulario/campo";
import { Aviso } from "@/components/ui/aviso";
import { botaoPrimario, campoInput, campoInputInvalido } from "@/lib/estilos";

import { definirSenhaOrgao } from "./actions";

export function FormularioDefinirSenha({ token }: { token: string }) {
  const t = useTranslations("DefinirSenhaOrgao");
  const acaoComToken = definirSenhaOrgao.bind(null, token);
  const [state, action, pending] = useActionState(acaoComToken, undefined);
  const erroSenha = state?.erros?.senha?.[0];
  const erroConfirmar = state?.erros?.confirmarSenha?.[0];

  return (
    <form action={action} className="flex w-full flex-col gap-5">
      <Campo id="definir-senha" rotulo={t("crieSenha")} erro={erroSenha}>
        <input
          id="definir-senha"
          type="password"
          name="senha"
          autoComplete="new-password"
          aria-invalid={erroSenha ? true : undefined}
          aria-describedby={descritoPor("definir-senha", erroSenha)}
          className={erroSenha ? campoInputInvalido : campoInput}
        />
      </Campo>

      <Campo id="definir-confirmar" rotulo={t("confirmeSenha")} erro={erroConfirmar}>
        <input
          id="definir-confirmar"
          type="password"
          name="confirmarSenha"
          autoComplete="new-password"
          aria-invalid={erroConfirmar ? true : undefined}
          aria-describedby={descritoPor("definir-confirmar", erroConfirmar)}
          className={erroConfirmar ? campoInputInvalido : campoInput}
        />
      </Campo>

      {state?.mensagem && <Aviso tom="info">{state.mensagem}</Aviso>}

      <button type="submit" disabled={pending} className={`${botaoPrimario} w-full py-3`}>
        {t("definirEEntrar")}
      </button>
    </form>
  );
}
