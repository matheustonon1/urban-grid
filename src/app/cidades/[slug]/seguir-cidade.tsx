"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Rss } from "lucide-react";
import { useTranslations } from "next-intl";

import { criarAssinatura } from "@/app/(app)/painel/assinaturas/actions";
import { botaoSecundario } from "@/lib/estilos";

export function SeguirCidade({
  cidadeId,
  logado,
  jaAssina,
}: {
  cidadeId: string;
  logado: boolean;
  jaAssina: boolean;
}) {
  const t = useTranslations("CidadeDetalhe");
  const [state, action, pending] = useActionState(criarAssinatura, undefined);

  if (jaAssina) {
    return (
      <p className="text-sm text-ink-muted">
        {t("jaAcompanha")}{" "}
        <Link href="/painel/assinaturas" className="text-brand underline">
          {t("gerenciarAssinaturas")}
        </Link>
      </p>
    );
  }

  if (!logado) {
    return (
      <p className="text-sm text-ink-muted">
        <Link href="/login" className="text-brand underline">
          {t("entrarParaAcompanhar")}
        </Link>
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="cidadeId" value={cidadeId} />
      <button type="submit" disabled={pending} className={`${botaoSecundario} w-fit`}>
        <Rss className="h-4 w-4" aria-hidden />
        {t("acompanharCidade")}
      </button>
      {state?.erro && <p className="text-sm text-danger-ink">{state.erro}</p>}
    </form>
  );
}
