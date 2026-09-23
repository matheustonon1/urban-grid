"use client";

import { useActionState, useState } from "react";
import { Check, Copy, KeyRound, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";

import { botaoPrimario, campoInput, cartao } from "@/lib/estilos";

import { cancelarConfiguracaoTotp, confirmarTotp, desativarTotp, iniciarConfiguracaoTotp } from "./totp-actions";

function formatarChave(segredo: string) {
  return segredo.match(/.{1,4}/g)?.join(" ") ?? segredo;
}

function BotaoCopiar({ texto }: { texto: string }) {
  const t = useTranslations("Totp");
  const [copiado, setCopiado] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(texto);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      }}
      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
    >
      {copiado ? (
        <>
          <Check className="h-3.5 w-3.5" aria-hidden /> {t("copiado")}
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" aria-hidden /> {t("copiar")}
        </>
      )}
    </button>
  );
}

export function FormularioTotp({
  ativo,
  pendente,
  qrCodeDataUrl,
  segredoManual,
}: {
  ativo: boolean;
  pendente: boolean;
  qrCodeDataUrl?: string;
  segredoManual?: string;
}) {
  const t = useTranslations("Totp");
  const [stateConfirmar, actionConfirmar, pendingConfirmar] = useActionState(
    confirmarTotp,
    undefined
  );
  const [stateDesativar, actionDesativar, pendingDesativar] = useActionState(
    desativarTotp,
    undefined
  );

  // Prioridade sobre qualquer outro estado: os códigos de backup só
  // existem uma vez, no retorno desta action - se navegar pra fora e
  // voltar, a página recarrega sem eles (ativo=true cai no branch normal).
  if (stateConfirmar?.codigosBackup) {
    return (
      <div className={`animate-fade-in flex flex-col gap-3 ${cartao}`}>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400" aria-hidden />
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">{t("ativada")}</h2>
        </div>
        <p className="text-sm text-slate-700 dark:text-slate-300">{t("guardeCodigos")}</p>
        <div className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t("codigosBackup")}
            </span>
            <BotaoCopiar texto={stateConfirmar.codigosBackup.join("\n")} />
          </div>
          <ul className="grid grid-cols-2 gap-2 font-mono text-sm text-slate-800 dark:text-slate-200">
            {stateConfirmar.codigosBackup.map((codigo) => (
              <li key={codigo}>{codigo}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (ativo) {
    return (
      <div className={`flex flex-col gap-3 ${cartao}`}>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400" aria-hidden />
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">
            {t("duasEtapas")}
          </h2>
        </div>
        <p className="text-sm text-green-700 dark:text-green-400">{t("ativadaPorApp")}</p>
        <form action={actionDesativar} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="totp-senha-desativar"
              className="text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              {t("confirmeSenhaDesativar")}
            </label>
            <input
              id="totp-senha-desativar"
              type="password"
              name="senhaAtual"
              className={campoInput}
            />
            {stateDesativar?.erros?.senhaAtual && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {stateDesativar.erros.senhaAtual[0]}
              </p>
            )}
          </div>
          {stateDesativar?.mensagem && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {stateDesativar.mensagem}
            </p>
          )}
          <button
            type="submit"
            disabled={pendingDesativar}
            className="w-fit rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 active:scale-95 disabled:opacity-50 disabled:active:scale-100 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            {t("desativarAutenticador")}
          </button>
        </form>
      </div>
    );
  }

  if (pendente) {
    return (
      <div className={`animate-fade-in flex flex-col gap-4 ${cartao}`}>
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" aria-hidden />
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">
            {t("configurarAutenticador")}
          </h2>
        </div>

        <div className="flex flex-col gap-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {t("passo1")}
          </p>
          <p className="-mt-2 text-xs text-slate-500 dark:text-slate-400">{t("appExemplos")}</p>
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            {qrCodeDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- data URL gerado no servidor, não é uma imagem hospedada
              <img
                src={qrCodeDataUrl}
                alt={t("qrCodeAlt")}
                className="h-36 w-36 shrink-0 rounded-lg bg-white p-2 shadow-sm"
              />
            )}
            {segredoManual && (
              <div className="flex w-full flex-col gap-1">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {t("ouDigiteChave")}
                </span>
                <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                  <p className="break-all font-mono text-sm tracking-wide text-slate-700 dark:text-slate-300">
                    {formatarChave(segredoManual)}
                  </p>
                  <BotaoCopiar texto={segredoManual} />
                </div>
              </div>
            )}
          </div>
        </div>

        <form action={actionConfirmar} className="flex flex-col gap-2">
          <label
            htmlFor="codigo-totp"
            className="text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            {t("passo2")}
          </label>
          <input
            id="codigo-totp"
            type="text"
            name="codigo"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            placeholder="000000"
            autoComplete="one-time-code"
            className={`${campoInput} text-center font-mono text-lg tracking-[0.4em]`}
          />
          {stateConfirmar?.erros?.codigo && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {stateConfirmar.erros.codigo[0]}
            </p>
          )}
          {stateConfirmar?.mensagem && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {stateConfirmar.mensagem}
            </p>
          )}
          <button
            type="submit"
            disabled={pendingConfirmar}
            className={`${botaoPrimario} mt-1 w-fit`}
          >
            {t("confirmar")}
          </button>
        </form>
        <form action={cancelarConfiguracaoTotp}>
          <button
            type="submit"
            className="text-xs text-slate-500 underline dark:text-slate-400"
          >
            {t("cancelarConfiguracao")}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-3 ${cartao}`}>
      <div className="flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-slate-400 dark:text-slate-500" aria-hidden />
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">{t("duasEtapas")}</h2>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400">{t("duasEtapasDesc")}</p>
      <form action={iniciarConfiguracaoTotp}>
        <button type="submit" className={`${botaoPrimario} w-fit`}>
          {t("ativarAutenticador")}
        </button>
      </form>
    </div>
  );
}
