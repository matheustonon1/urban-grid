import type { ReactNode } from "react";
import { CircleCheck, Shield, TriangleAlert } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { cartaoSecao } from "@/lib/estilos";
import { CabecalhoCartao } from "@/components/ui/cabecalho-cartao";

import { BotaoEncerrarSessoes, BotaoReenviarVerificacao } from "./formularios";

function Situacao({ ok, children }: { ok: boolean; children: string }) {
  const Icone = ok ? CircleCheck : TriangleAlert;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium ${
        ok ? "text-ok-ink" : "text-warn-ink"
      }`}
    >
      <Icone className="h-4 w-4 shrink-0" aria-hidden />
      {children}
    </span>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
      <dt className="text-ink-muted">{rotulo}</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}

export async function ResumoSeguranca({
  totpAtivo,
  emailVerificado,
  criadoEm,
}: {
  totpAtivo: boolean;
  emailVerificado: boolean;
  criadoEm: Date;
}) {
  const t = await getTranslations("Conta");
  const locale = await getLocale();

  return (
    <section className={`flex flex-col gap-3 ${cartaoSecao}`}>
      <CabecalhoCartao icone={Shield} titulo={t("segurancaConta")} />

      <dl className="flex flex-col divide-y divide-line text-sm">
        <Linha rotulo={t("duasEtapas")}>
          <Situacao ok={totpAtivo}>{totpAtivo ? t("ativada") : t("desativada")}</Situacao>
        </Linha>
        <Linha rotulo={t("emailRotulo")}>
          <Situacao ok={emailVerificado}>
            {emailVerificado ? t("emailVerificado") : t("emailNaoVerificado")}
          </Situacao>
        </Linha>
        <Linha rotulo={t("contaCriadaEm")}>
          <span className="font-mono tabular-nums">
            {criadoEm.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" })}
          </span>
        </Linha>
      </dl>

      {!emailVerificado && <BotaoReenviarVerificacao />}

      <div className="flex flex-col gap-2 border-t border-line pt-3">
        <p className="text-sm text-ink-muted">{t("encerrarSessoesDesc")}</p>
        <BotaoEncerrarSessoes />
      </div>
    </section>
  );
}
