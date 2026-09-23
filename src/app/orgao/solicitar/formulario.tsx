"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { SeletorCidade } from "@/components/cidade-combobox";
import { TermosModal } from "@/components/termos-modal";
import { botaoPrimario, botaoSecundario, campoInput, cartaoDestaque, linkSutil } from "@/lib/estilos";

import { solicitarOrgao } from "./actions";

export function FormularioSolicitarOrgao() {
  const t = useTranslations("Cadastro");
  const [state, action, pending] = useActionState(solicitarOrgao, undefined);

  if (state?.sucesso) {
    return (
      <div className={`flex flex-col items-center gap-3 text-center ${cartaoDestaque}`}>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {t("solicitacaoEnviadaTitulo")}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">{state.mensagem}</p>
        <Link href="/" className={`${botaoSecundario} mt-1`}>
          {t("voltarInicio")}
        </Link>
      </div>
    );
  }

  return (
    <>
      <form action={action} className={`flex flex-col gap-3 ${cartaoDestaque}`}>
        <input
          type="text"
          name="nomeOrgao"
          placeholder={t("nomeOrgaoPlaceholder")}
          className={campoInput}
        />
        {state?.erros?.nomeOrgao && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.erros.nomeOrgao[0]}</p>
        )}

        <input type="text" name="sigla" placeholder={t("sigla")} className={campoInput} />

        <SeletorCidade name="cidadeId" required placeholder={t("cidade")} />
        {state?.erros?.cidadeId && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.erros.cidadeId[0]}</p>
        )}

        <input
          type="text"
          name="nomeResponsavel"
          placeholder={t("seuNomeCompleto")}
          className={campoInput}
        />
        {state?.erros?.nomeResponsavel && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {state.erros.nomeResponsavel[0]}
          </p>
        )}

        <input
          type="email"
          name="email"
          placeholder={t("emailInstitucional")}
          className={campoInput}
        />
        {state?.erros?.email && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.erros.email[0]}</p>
        )}

        <input
          type="tel"
          name="telefone"
          placeholder={t("telefoneOpcional")}
          className={campoInput}
        />

        <label className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
          <input type="checkbox" name="aceitaTermos" required className="mt-0.5" />
          <span>
            {t("liEAceito")} <TermosModal />.
          </span>
        </label>
        {state?.erros?.aceitaTermos && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.erros.aceitaTermos[0]}</p>
        )}

        {state?.mensagem && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.mensagem}</p>
        )}

        <button type="submit" disabled={pending} className={botaoPrimario}>
          {t("enviarSolicitacao")}
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
