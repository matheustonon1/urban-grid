"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Aviso } from "@/components/ui/aviso";
import { Etiqueta } from "@/components/ui/etiqueta";
import { botaoSecundario } from "@/lib/estilos";

import { consultarCnpjDaSolicitacao } from "./actions";

// Botão que confere o CNPJ do pedido no cadastro público e mostra o resultado ali mesmo (um
// aviso passageiro sumiria enquanto o admin ainda lê). Indício a mais para decidir, nada que
// trave a aprovação.
export function ConsultarCnpj({ solicitacaoId }: { solicitacaoId: string }) {
  const t = useTranslations("SolicitacoesOrgao");
  const [estado, consultar, pendente] = useActionState(
    consultarCnpjDaSolicitacao.bind(null, solicitacaoId),
    undefined
  );

  return (
    <div className="flex flex-col gap-2.5">
      <form action={consultar}>
        <button type="submit" disabled={pendente} className={`${botaoSecundario} w-fit`}>
          {pendente ? t("consultandoCnpj") : t("consultarCnpj")}
        </button>
      </form>

      <div aria-live="polite" className="flex flex-col gap-2.5">
        {estado?.ok === false && (
          <Aviso tom={estado.motivo === "naoEncontrado" ? "atencao" : "info"}>
            {t(`cnpjErro.${estado.motivo}`)}
          </Aviso>
        )}

        {estado?.ok && (
          <div className="flex flex-col gap-2 rounded-md border border-line bg-sunken/40 p-3">
            <p className="text-sm font-semibold text-ink">{estado.dados.razaoSocial}</p>
            {estado.dados.nomeFantasia && (
              <p className="text-xs text-ink-muted">{estado.dados.nomeFantasia}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Etiqueta tom={estado.dados.situacaoAtiva ? "sucesso" : "atencao"}>
                {t("cnpjSituacao", { situacao: estado.dados.situacao })}
              </Etiqueta>
              <Etiqueta tom={estado.dados.administracaoPublica ? "sucesso" : "atencao"}>
                {t(
                  estado.dados.administracaoPublica ? "cnpjAdministracaoPublica" : "cnpjNaoAdministracaoPublica",
                  { natureza: estado.dados.naturezaJuridica }
                )}
              </Etiqueta>
              {(estado.dados.municipio || estado.dados.uf) && (
                <Etiqueta tom="neutro">
                  {[estado.dados.municipio, estado.dados.uf].filter(Boolean).join(" - ")}
                </Etiqueta>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
