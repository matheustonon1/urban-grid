"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";

import { Campo } from "@/components/formulario/campo";
import { Aviso } from "@/components/ui/aviso";
import { botaoPrimario, campoInput, linkSutil } from "@/lib/estilos";

import { login, type LoginFormState } from "./actions";

export function FormularioLogin({ callbackUrl }: { callbackUrl?: string }) {
  const t = useTranslations("Login");

  // O React zera os campos de um <form action> ao fim da ação. Para a pessoa não redigitar a
  // senha no passo do código (ou o e-mail depois de errar a senha), o que foi digitado fica
  // guardado AQUI, só no navegador, e volta como defaultValue. O servidor não devolve mais a
  // senha na resposta (ver LoginFormState). Os campos seguem não controlados de propósito:
  // quem digita antes da hidratação não perde o texto.
  const [digitado, setDigitado] = useState({ identificador: "", senha: "" });
  const [state, action, pending] = useActionState(
    async (anterior: LoginFormState, dados: FormData) => {
      const identificador = String(dados.get("identificador") ?? "");
      const senha = String(dados.get("senha") ?? "");
      const resultado = await login(anterior, dados);
      // Senha errada: o e-mail fica e a senha é limpa. Senha certa à espera do código, ou
      // código errado: os dois ficam, e só o código é pedido de novo.
      setDigitado({
        identificador,
        senha: resultado?.erro && !resultado.etapaTotp ? "" : senha,
      });
      return resultado;
    },
    undefined
  );

  return (
    <form action={action} className="flex flex-col gap-5">
      {callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}

      <Campo id="login-identificador" rotulo={t("identificador")}>
        <input
          id="login-identificador"
          type="text"
          name="identificador"
          autoComplete="username"
          defaultValue={digitado.identificador}
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
          defaultValue={digitado.senha}
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
