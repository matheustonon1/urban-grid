"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Campo, descritoPor } from "@/components/formulario/campo";
import { Aviso } from "@/components/ui/aviso";
import { botaoPrimario, campoInput, campoInputInvalido } from "@/lib/estilos";

import { solicitarRedefinicaoSenha } from "./actions";

export function FormularioEsqueciSenha() {
  const t = useTranslations("EsqueciSenha");
  const [state, action, pending] = useActionState(solicitarRedefinicaoSenha, undefined);
  const erroEmail = state?.erros?.email?.[0];

  return (
    <form action={action} className="flex flex-col gap-5">
      <Campo id="esqueci-email" rotulo={t("emailPlaceholder")} erro={erroEmail}>
        <input
          id="esqueci-email"
          type="email"
          name="email"
          autoComplete="email"
          required
          aria-invalid={erroEmail ? true : undefined}
          aria-describedby={descritoPor("esqueci-email", erroEmail)}
          className={erroEmail ? campoInputInvalido : campoInput}
        />
      </Campo>

      {state?.mensagem && <Aviso tom="info">{state.mensagem}</Aviso>}

      <button type="submit" disabled={pending} className={`${botaoPrimario} w-full py-3`}>
        {t("enviarLink")}
      </button>
    </form>
  );
}
