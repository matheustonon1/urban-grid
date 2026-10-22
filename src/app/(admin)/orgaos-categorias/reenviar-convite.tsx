"use client";

import { useActionState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import { Aviso } from "@/components/ui/aviso";

import { reenviarConviteOrgao } from "./actions";

// Botão "Reenviar convite" com o resultado do envio logo abaixo. Antes era um
// <form> sem retorno: o provedor de e-mail podia recusar o envio (o remetente
// de teste do Resend só entrega para o e-mail da própria conta) e o admin não
// via nada, só o e-mail que não chegava.
export function ReenviarConvite({
  userId,
  email,
  mostrarDica,
}: {
  userId: string;
  email: string;
  // Dica sobre como configurar o remetente: só em desenvolvimento (fala de
  // variáveis de ambiente, que não é assunto de tela de admin em produção).
  mostrarDica: boolean;
}) {
  const t = useTranslations("OrgaosCategorias");
  const [estado, acao, pendente] = useActionState(reenviarConviteOrgao.bind(null, userId), undefined);

  return (
    <form action={acao} className="mt-1 flex flex-col gap-2">
      <button
        type="submit"
        disabled={pendente}
        aria-busy={pendente}
        className="flex w-fit items-center gap-1.5 text-left text-xs text-primary hover:underline disabled:opacity-60"
      >
        {pendente && <LoaderCircle className="h-3 w-3 animate-spin" aria-hidden />}
        {pendente ? t("reenviandoConvite") : t("reenviarConvite", { email })}
      </button>

      <div role="status" aria-live="polite">
        {estado?.status === "enviado" && (
          <p className="flex items-start gap-1.5 text-xs text-green-700 dark:text-green-400">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={3} aria-hidden />
            {t("conviteEnviado", { email })}
          </p>
        )}
        {estado?.status === "simulado" && <Aviso tom="atencao">{t("conviteSimulado")}</Aviso>}
        {estado?.status === "falhou" && (
          <Aviso tom="erro">
            <p>{t("conviteFalhou", { email, motivo: estado.motivo })}</p>
            {mostrarDica && <p className="mt-1.5 text-xs opacity-90">{t("conviteFalhouDica")}</p>}
          </Aviso>
        )}
        {estado?.status === "indisponivel" && <Aviso tom="info">{t("conviteIndisponivel")}</Aviso>}
      </div>
    </form>
  );
}
