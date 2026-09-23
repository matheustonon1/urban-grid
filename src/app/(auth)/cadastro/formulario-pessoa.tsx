"use client";

import { useActionState } from "react";
import Link from "next/link";
import Script from "next/script";
import { useTranslations } from "next-intl";

import { TermosModal } from "@/components/termos-modal";
import { botaoPrimario, campoInput, cartaoDestaque, linkSutil } from "@/lib/estilos";

import { cadastrar } from "./actions";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export function FormularioCadastroPessoa() {
  const t = useTranslations("Cadastro");
  const [state, action, pending] = useActionState(cadastrar, undefined);

  return (
    <>
      {TURNSTILE_SITE_KEY && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="afterInteractive"
        />
      )}

      <form action={action} className={`flex flex-col gap-3 ${cartaoDestaque}`}>
        <input
          type="text"
          name="nome"
          placeholder={t("nomeCompleto")}
          className={campoInput}
        />
        {state?.erros?.nome && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.erros.nome[0]}</p>
        )}

        <input
          type="email"
          name="email"
          placeholder={t("email")}
          className={campoInput}
        />
        {state?.erros?.email && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.erros.email[0]}</p>
        )}

        <input
          type="text"
          name="cpf"
          placeholder={t("cpf")}
          className={campoInput}
        />
        {state?.erros?.cpf && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.erros.cpf[0]}</p>
        )}

        <input
          type="password"
          name="senha"
          placeholder={t("senha")}
          className={campoInput}
        />
        {state?.erros?.senha && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.erros.senha[0]}</p>
        )}

        <input
          type="password"
          name="confirmarSenha"
          placeholder={t("confirmarSenha")}
          className={campoInput}
        />
        {state?.erros?.confirmarSenha && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {state.erros.confirmarSenha[0]}
          </p>
        )}

        <label className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
          <input type="checkbox" name="aceitaTermos" required className="mt-0.5" />
          <span>
            {t("liEAceito")} <TermosModal />.
          </span>
        </label>
        {state?.erros?.aceitaTermos && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.erros.aceitaTermos[0]}</p>
        )}

        {TURNSTILE_SITE_KEY && (
          <div className="cf-turnstile" data-sitekey={TURNSTILE_SITE_KEY} />
        )}

        {state?.mensagem && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.mensagem}</p>
        )}

        <button type="submit" disabled={pending} className={botaoPrimario}>
          {t("criarConta")}
        </button>

        <div className="mt-1 flex justify-center border-t border-slate-100 pt-4 dark:border-slate-800">
          <Link href="/login" className={linkSutil}>
            {t("jaTemConta")} <span className="font-semibold">{t("entrar")}</span>
          </Link>
        </div>
      </form>
    </>
  );
}
