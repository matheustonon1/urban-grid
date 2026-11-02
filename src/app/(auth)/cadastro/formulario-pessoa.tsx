"use client";

import { useActionState } from "react";
import Link from "next/link";
import Script from "next/script";
import { useTranslations } from "next-intl";

import { Campo, MensagemErro, descritoPor } from "@/components/formulario/campo";
import { TermosModal } from "@/components/formulario/termos-modal";
import { Aviso } from "@/components/ui/aviso";
import { botaoPrimario, campoInput, campoInputInvalido, linkSutil } from "@/lib/estilos";

import { cadastrar } from "./actions";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export function FormularioCadastroPessoa() {
  const t = useTranslations("Cadastro");
  const [state, action, pending] = useActionState(cadastrar, undefined);
  const erros = state?.erros;

  // Atributos de acessibilidade e de estilo de um campo com (ou sem) erro.
  const atributos = (id: string, erro?: string) => ({
    id,
    className: erro ? campoInputInvalido : campoInput,
    "aria-invalid": erro ? true : undefined,
    "aria-describedby": descritoPor(id, erro),
  });

  return (
    <>
      {TURNSTILE_SITE_KEY && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="afterInteractive"
        />
      )}

      <form action={action} className="flex w-full flex-col gap-5">
        <Campo id="cadastro-nome" rotulo={t("nomeCompleto")} erro={erros?.nome?.[0]}>
          <input
            type="text"
            name="nome"
            autoComplete="name"
            {...atributos("cadastro-nome", erros?.nome?.[0])}
          />
        </Campo>

        <Campo id="cadastro-email" rotulo={t("email")} erro={erros?.email?.[0]}>
          <input
            type="email"
            name="email"
            autoComplete="email"
            {...atributos("cadastro-email", erros?.email?.[0])}
          />
        </Campo>

        <Campo id="cadastro-cpf" rotulo={t("cpf")} erro={erros?.cpf?.[0]}>
          <input
            type="text"
            name="cpf"
            inputMode="numeric"
            autoComplete="off"
            {...atributos("cadastro-cpf", erros?.cpf?.[0])}
          />
        </Campo>

        <div className="grid gap-5 sm:grid-cols-2">
          <Campo id="cadastro-senha" rotulo={t("senha")} erro={erros?.senha?.[0]}>
            <input
              type="password"
              name="senha"
              autoComplete="new-password"
              {...atributos("cadastro-senha", erros?.senha?.[0])}
            />
          </Campo>

          <Campo
            id="cadastro-confirmar"
            rotulo={t("confirmarSenha")}
            erro={erros?.confirmarSenha?.[0]}
          >
            <input
              type="password"
              name="confirmarSenha"
              autoComplete="new-password"
              {...atributos("cadastro-confirmar", erros?.confirmarSenha?.[0])}
            />
          </Campo>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="flex items-start gap-2.5 text-sm text-ink-muted">
            <input
              type="checkbox"
              name="aceitaTermos"
              required
              aria-describedby={erros?.aceitaTermos ? "cadastro-termos-erro" : undefined}
              className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
            />
            <span>
              {t("liEAceito")} <TermosModal />.
            </span>
          </label>
          {erros?.aceitaTermos && (
            <MensagemErro id="cadastro-termos">{erros.aceitaTermos[0]}</MensagemErro>
          )}
        </div>

        {TURNSTILE_SITE_KEY && <div className="cf-turnstile" data-sitekey={TURNSTILE_SITE_KEY} />}

        {state?.mensagem && <Aviso tom="erro">{state.mensagem}</Aviso>}

        <button type="submit" disabled={pending} className={`${botaoPrimario} w-full py-3`}>
          {t("criarConta")}
        </button>

        <div className="flex justify-center border-t border-line pt-5">
          <Link href="/login" className={linkSutil}>
            {t("jaTemConta")} <span className="font-semibold text-ink">{t("entrar")}</span>
          </Link>
        </div>
      </form>
    </>
  );
}
