import type { ReactNode } from "react";
import { CircleCheck, Shield, TriangleAlert } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { cartao } from "@/lib/estilos";

import { BotaoEncerrarSessoes, BotaoReenviarVerificacao } from "./formularios";

function Situacao({ ok, children }: { ok: boolean; children: string }) {
  const Icone = ok ? CircleCheck : TriangleAlert;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium ${
        ok ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"
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
      <dt className="text-slate-600 dark:text-slate-400">{rotulo}</dt>
      <dd className="text-slate-900 dark:text-slate-100">{children}</dd>
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
    <section className={`flex flex-col gap-3 ${cartao}`}>
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-slate-400 dark:text-slate-500" aria-hidden />
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">{t("segurancaConta")}</h2>
      </div>

      <dl className="flex flex-col divide-y divide-slate-100 text-sm dark:divide-slate-800">
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

      <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("encerrarSessoesDesc")}</p>
        <BotaoEncerrarSessoes />
      </div>
    </section>
  );
}
