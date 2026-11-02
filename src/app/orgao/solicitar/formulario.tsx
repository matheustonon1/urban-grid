"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";

import { Campo, MensagemErro, descritoPor } from "@/components/formulario/campo";
import { SeletorCidade } from "@/components/formulario/cidade-combobox";
import { TermosModal } from "@/components/formulario/termos-modal";
import { Aviso } from "@/components/ui/aviso";
import {
  botaoPrimario,
  botaoSecundario,
  campoInput,
  campoInputInvalido,
  linkSutil,
} from "@/lib/estilos";

import { solicitarOrgao } from "./actions";

export function FormularioSolicitarOrgao() {
  const t = useTranslations("Cadastro");
  const [state, action, pending] = useActionState(solicitarOrgao, undefined);
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
    <form action={action} className="flex w-full flex-col gap-5">
      <Campo id="orgao-nome" rotulo={t("nomeOrgao")} erro={erros?.nomeOrgao?.[0]}>
        <input
          type="text"
          name="nomeOrgao"
          placeholder={t("nomeOrgaoExemplo")}
          {...atributos("orgao-nome", erros?.nomeOrgao?.[0])}
        />
      </Campo>

      <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
        <Campo id="orgao-cidade" rotulo={t("cidade")} erro={erros?.cidadeId?.[0]}>
          <SeletorCidade id="orgao-cidade" name="cidadeId" required placeholder={t("cidade")} />
        </Campo>

        <Campo id="orgao-sigla" rotulo={t("siglaRotulo")} opcional={t("opcional")}>
          <input type="text" name="sigla" id="orgao-sigla" className={campoInput} />
        </Campo>
      </div>

      <Campo
        id="orgao-responsavel"
        rotulo={t("seuNomeCompleto")}
        erro={erros?.nomeResponsavel?.[0]}
      >
        <input
          type="text"
          name="nomeResponsavel"
          autoComplete="name"
          {...atributos("orgao-responsavel", erros?.nomeResponsavel?.[0])}
        />
      </Campo>

      <Campo id="orgao-email" rotulo={t("emailInstitucional")} erro={erros?.email?.[0]}>
        <input
          type="email"
          name="email"
          autoComplete="email"
          {...atributos("orgao-email", erros?.email?.[0])}
        />
      </Campo>

      <Campo id="orgao-telefone" rotulo={t("telefone")} opcional={t("opcional")}>
        <input
          type="tel"
          name="telefone"
          id="orgao-telefone"
          autoComplete="tel"
          className={campoInput}
        />
      </Campo>

      <div className="flex flex-col gap-1.5">
        <label className="flex items-start gap-2.5 text-sm text-ink-muted">
          <input
            type="checkbox"
            name="aceitaTermos"
            required
            aria-describedby={erros?.aceitaTermos ? "orgao-termos-erro" : undefined}
            className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
          />
          <span>
            {t("liEAceito")} <TermosModal />.
          </span>
        </label>
        {erros?.aceitaTermos && (
          <MensagemErro id="orgao-termos">{erros.aceitaTermos[0]}</MensagemErro>
        )}
      </div>

      {state?.mensagem && <Aviso tom="erro">{state.mensagem}</Aviso>}

      <button type="submit" disabled={pending} className={`${botaoPrimario} w-full py-3`}>
        {t("enviarSolicitacao")}
      </button>

      <div className="flex justify-center border-t border-line pt-5">
        <Link href="/login" className={linkSutil}>
          {t("jaTemConta")} <span className="font-semibold text-ink">{t("entrar")}</span>
        </Link>
      </div>
    </form>
  );
}
