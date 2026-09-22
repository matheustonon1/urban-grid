"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { botaoPrimario, campoInput, cartaoDestaque, linkSutil } from "@/lib/estilos";

import { login } from "./actions";

export default function LoginPage() {
  const t = useTranslations("Login");
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center gap-6 overflow-hidden p-8">
      <div
        aria-hidden
        className="animate-grid-drift bg-dot-grid pointer-events-none absolute inset-0 -z-20"
      />
      <div
        aria-hidden
        className="animate-float pointer-events-none absolute left-1/2 top-0 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl dark:bg-blue-500/10"
      />

      <div className="animate-fade-in flex w-full max-w-sm flex-col items-center gap-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {t("titulo")}
        </h1>

        <form action={action} className={`flex flex-col gap-3 ${cartaoDestaque}`}>
          <input
            type="text"
            name="identificador"
            placeholder={t("identificador")}
            defaultValue={state?.identificador ?? ""}
            required
            className={campoInput}
          />
          <input
            type="password"
            name="senha"
            placeholder={t("senha")}
            required
            className={campoInput}
          />
          {state?.etapaTotp && (
            <input
              type="text"
              name="codigoTotp"
              inputMode="numeric"
              placeholder={t("codigoTotp")}
              autoFocus
              className={campoInput}
            />
          )}
          {state?.erro && <p className="text-sm text-red-600 dark:text-red-400">{state.erro}</p>}
          <button type="submit" disabled={pending} className={botaoPrimario}>
            {t("titulo")}
          </button>

          <Link href="/esqueci-senha" className="text-center text-xs text-slate-400 hover:text-primary dark:text-slate-500 dark:hover:text-blue-400">
            {t("esqueceuSenha")}
          </Link>

          <div className="mt-1 flex flex-col items-center gap-1 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Link href="/cadastro" className={linkSutil}>
              {t("semConta")} <span className="font-semibold">{t("cadastrese")}</span>
            </Link>
            <Link
              href="/cadastro?tipo=orgao"
              className="text-xs text-slate-400 transition-colors hover:text-primary dark:text-slate-500 dark:hover:text-blue-400"
            >
              {t("ehOrgao")}
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
