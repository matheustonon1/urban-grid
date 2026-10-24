"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Campo } from "@/components/formulario/campo";
import { Aviso } from "@/components/ui/aviso";
import { botaoPrimario, campoInput, linkSutil } from "@/lib/estilos";

import { login } from "./actions";

export function FormularioLogin() {
  const t = useTranslations("Login");
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} className="flex flex-col gap-5">
      <Campo id="login-identificador" rotulo={t("identificador")}>
        <input
          id="login-identificador"
          type="text"
          name="identificador"
          autoComplete="username"
          defaultValue={state?.identificador ?? ""}
          required
          className={campoInput}
        />
      </Campo>

      <Campo
        id="login-senha"
        rotulo={t("senha")}
        contador={
          <Link
            href="/esqueci-senha"
            className="text-xs font-medium text-brand underline-offset-2 hover:underline"
          >
            {t("esqueceuSenha")}
          </Link>
        }
      >
        <input
          id="login-senha"
          type="password"
          name="senha"
          autoComplete="current-password"
          defaultValue={state?.senha ?? ""}
          required
          className={campoInput}
        />
      </Campo>

      {state?.etapaTotp && (
        <Campo id="login-totp" rotulo={t("codigoTotp")}>
          <input
            id="login-totp"
            type="text"
            name="codigoTotp"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            className={`${campoInput} font-mono tracking-widest`}
          />
        </Campo>
      )}

      {state?.erro && <Aviso tom="erro">{state.erro}</Aviso>}

      <button type="submit" disabled={pending} className={`${botaoPrimario} w-full py-3`}>
        {t("titulo")}
      </button>

      <div className="flex flex-col items-center gap-1 border-t border-line pt-5">
        <Link href="/cadastro" className={linkSutil}>
          {t("semConta")} <span className="font-semibold text-ink">{t("cadastrese")}</span>
        </Link>
        <Link
          href="/cadastro?tipo=orgao"
          className="text-xs text-ink-muted underline-offset-2 transition-colors hover:text-brand hover:underline"
        >
          {t("ehOrgao")}
        </Link>
      </div>
    </form>
  );
}
