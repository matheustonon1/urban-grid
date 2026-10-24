"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";

import { Campo, descritoPor } from "@/components/formulario/campo";
import { Aviso } from "@/components/ui/aviso";
import { botaoPrimario, botaoSecundario, campoInput, campoInputInvalido } from "@/lib/estilos";

import { solicitarCidade } from "./actions";
import { UFS_BRASIL } from "./definitions";

export function FormularioSolicitarCidade() {
  const t = useTranslations("SolicitarCidade");
  const [state, action, pending] = useActionState(solicitarCidade, undefined);
  const erros = state?.erros;

  const atributos = (id: string, erro?: string) => ({
    id,
    className: erro ? campoInputInvalido : campoInput,
    "aria-invalid": erro ? true : undefined,
    "aria-describedby": descritoPor(id, erro),
  });

  if (state?.sucesso) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-ok-ink/30 bg-ok-soft p-6 text-ok-ink">
        <CircleCheck className="h-6 w-6" aria-hidden />
        <h2 className="text-xl font-bold">{t("solicitacaoEnviadaTitulo")}</h2>
        <p className="text-sm">{state.mensagem}</p>
        <Link href="/" className={`${botaoSecundario} mt-1`}>
          {t("voltarInicio")}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-[1fr_7rem]">
        <Campo id="cidade-nome" rotulo={t("nomeCidadePlaceholder")} erro={erros?.nomeCidade?.[0]}>
          <input type="text" name="nomeCidade" {...atributos("cidade-nome", erros?.nomeCidade?.[0])} />
        </Campo>

        <Campo id="cidade-uf" rotulo={t("ufPlaceholder")} erro={erros?.uf?.[0]}>
          <select name="uf" defaultValue="" {...atributos("cidade-uf", erros?.uf?.[0])}>
            <option value="" disabled>
              —
            </option>
            {UFS_BRASIL.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <Campo
        id="cidade-solicitante"
        rotulo={t("seuNomeCompleto")}
        erro={erros?.nomeSolicitante?.[0]}
      >
        <input
          type="text"
          name="nomeSolicitante"
          autoComplete="name"
          {...atributos("cidade-solicitante", erros?.nomeSolicitante?.[0])}
        />
      </Campo>

      <Campo id="cidade-email" rotulo={t("emailPlaceholder")} erro={erros?.email?.[0]}>
        <input
          type="email"
          name="email"
          autoComplete="email"
          {...atributos("cidade-email", erros?.email?.[0])}
        />
      </Campo>

      {state?.mensagem && <Aviso tom="erro">{state.mensagem}</Aviso>}

      <button type="submit" disabled={pending} className={`${botaoPrimario} w-full py-3`}>
        {t("enviarSolicitacao")}
      </button>
    </form>
  );
}
