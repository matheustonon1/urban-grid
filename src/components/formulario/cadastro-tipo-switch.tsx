"use client";

import { useState } from "react";
import { IdCard, Landmark } from "lucide-react";
import { useTranslations } from "next-intl";

import { FormularioCadastroPessoa } from "@/app/(auth)/cadastro/formulario-pessoa";
import { FormularioSolicitarOrgao } from "@/app/orgao/solicitar/formulario";

type TipoCadastro = "pessoa" | "orgao";

export function CadastroTipoSwitch({ tipoInicial }: { tipoInicial: TipoCadastro }) {
  const t = useTranslations("Cadastro");
  const [tipo, setTipo] = useState<TipoCadastro>(tipoInicial);
  const ehOrgao = tipo === "orgao";

  return (
    <>
      <div className="flex w-full flex-col items-center gap-3 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {ehOrgao ? t("tituloOrgao") : t("criarConta")}
        </h1>
        {ehOrgao && (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("descOrgao")}</p>
        )}

        <button
          type="button"
          role="switch"
          aria-checked={ehOrgao}
          aria-label={ehOrgao ? t("ariaOrgaoSelecionado") : t("ariaPessoaSelecionado")}
          onClick={() => setTipo(ehOrgao ? "pessoa" : "orgao")}
          className={`relative mt-1 h-9 w-18 shrink-0 rounded-full transition-colors duration-300 ease-in-out active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
            ehOrgao ? "bg-primary dark:bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
          }`}
        >
          <IdCard
            aria-hidden
            className={`absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2 text-white transition-opacity duration-300 ${
              ehOrgao ? "opacity-60" : "opacity-0"
            }`}
          />
          <Landmark
            aria-hidden
            className={`absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-slate-500 transition-opacity duration-300 dark:text-slate-300 ${
              ehOrgao ? "opacity-0" : "opacity-60"
            }`}
          />
          <span
            className="absolute top-0.5 left-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md transition-transform duration-300 ease-in-out dark:bg-slate-100"
            style={{ transform: ehOrgao ? "translateX(2.25rem)" : "translateX(0)" }}
          >
            <span key={tipo} className="animate-icon-pop flex items-center justify-center">
              {ehOrgao ? (
                <Landmark aria-hidden className="h-4 w-4 text-primary dark:text-blue-600" />
              ) : (
                <IdCard aria-hidden className="h-4 w-4 text-primary dark:text-blue-600" />
              )}
            </span>
          </span>
        </button>
      </div>

      <div key={tipo} className="animate-fade-in flex w-full flex-col items-center gap-4">
        {ehOrgao ? <FormularioSolicitarOrgao /> : <FormularioCadastroPessoa />}
      </div>
    </>
  );
}
