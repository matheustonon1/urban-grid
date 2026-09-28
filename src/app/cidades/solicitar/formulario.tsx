"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { botaoPrimario, botaoSecundario, campoInput, cartaoDestaque } from "@/lib/estilos";

import { solicitarCidade } from "./actions";
import { UFS_BRASIL } from "./definitions";

export function FormularioSolicitarCidade() {
  const t = useTranslations("SolicitarCidade");
  const [state, action, pending] = useActionState(solicitarCidade, undefined);

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
    <form action={action} className={`flex flex-col gap-3 ${cartaoDestaque}`}>
      <input
        type="text"
        name="nomeCidade"
        placeholder={t("nomeCidadePlaceholder")}
        className={campoInput}
      />
      {state?.erros?.nomeCidade && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.erros.nomeCidade[0]}</p>
      )}

      <select name="uf" defaultValue="" className={campoInput}>
        <option value="" disabled>
          {t("ufPlaceholder")}
        </option>
        {UFS_BRASIL.map((uf) => (
          <option key={uf} value={uf}>
            {uf}
          </option>
        ))}
      </select>
      {state?.erros?.uf && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.erros.uf[0]}</p>
      )}

      <input
        type="text"
        name="nomeSolicitante"
        placeholder={t("seuNomeCompleto")}
        className={campoInput}
      />
      {state?.erros?.nomeSolicitante && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {state.erros.nomeSolicitante[0]}
        </p>
      )}

      <input type="email" name="email" placeholder={t("emailPlaceholder")} className={campoInput} />
      {state?.erros?.email && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.erros.email[0]}</p>
      )}

      {state?.mensagem && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.mensagem}</p>
      )}

      <button type="submit" disabled={pending} className={botaoPrimario}>
        {t("enviarSolicitacao")}
      </button>
    </form>
  );
}
