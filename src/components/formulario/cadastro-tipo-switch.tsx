"use client";

import { useState } from "react";
import { IdCard, Landmark } from "lucide-react";
import { useTranslations } from "next-intl";

import { FormularioCadastroPessoa } from "@/app/(auth)/cadastro/formulario-pessoa";
import { FormularioSolicitarOrgao } from "@/app/orgao/solicitar/formulario";

type TipoCadastro = "pessoa" | "orgao";

// Dois botões lado a lado (controle segmentado) em vez do interruptor de
// ícones: quem chega aqui precisa SABER que existem dois tipos de conta, e um
// interruptor só com desenhos escondia isso. aria-pressed mantém o estado
// anunciado pra leitor de tela.
export function CadastroTipoSwitch({ tipoInicial }: { tipoInicial: TipoCadastro }) {
  const t = useTranslations("Cadastro");
  const [tipo, setTipo] = useState<TipoCadastro>(tipoInicial);
  const ehOrgao = tipo === "orgao";

  const opcoes = [
    { valor: "pessoa", rotulo: t("tipoPessoa"), icone: IdCard },
    { valor: "orgao", rotulo: t("tipoOrgao"), icone: Landmark },
  ] as const;

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">
          {ehOrgao ? t("tituloOrgao") : t("criarConta")}
        </h1>
        {ehOrgao && <p className="text-ink-muted">{t("descOrgao")}</p>}
      </div>

      <div role="group" aria-label={t("tipoDeConta")} className="grid grid-cols-2 gap-1 rounded-md bg-sunken p-1">
        {opcoes.map(({ valor, rotulo, icone: Icone }) => {
          const ativo = tipo === valor;
          return (
            <button
              key={valor}
              type="button"
              aria-pressed={ativo}
              onClick={() => setTipo(valor)}
              className={`flex items-center justify-center gap-2 rounded-[5px] px-3 py-2 text-sm font-semibold transition-colors ${
                ativo
                  ? "bg-surface text-ink shadow-[0_1px_2px_rgb(14_21_32/0.12)]"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              <Icone aria-hidden className="h-4 w-4" />
              {rotulo}
            </button>
          );
        })}
      </div>

      <div key={tipo} className="animate-fade-in flex w-full flex-col gap-4">
        {ehOrgao ? <FormularioSolicitarOrgao /> : <FormularioCadastroPessoa />}
      </div>
    </>
  );
}
