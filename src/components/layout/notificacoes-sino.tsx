"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { useFecharAoInteragirFora } from "@/hooks/useFecharAoInteragirFora";
import { formatarTempoRelativo } from "@/lib/util/tempo-relativo";

import { marcarNotificacaoLida, marcarTodasLidas } from "./notificacoes-actions";

interface NotificacaoItem {
  id: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  createdAt: Date;
  protocolo: string | null;
}

export function NotificacoesSino({
  notificacoes,
  totalNaoLidas,
}: {
  notificacoes: NotificacaoItem[];
  totalNaoLidas: number;
}) {
  const t = useTranslations("Notificacoes");
  const locale = useLocale();
  const [aberto, setAberto] = useState(false);
  const containerRef = useFecharAoInteragirFora<HTMLDivElement>(aberto, () => setAberto(false));

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setAberto((valor) => !valor)}
        aria-expanded={aberto}
        aria-label={t("botaoAria", { count: totalNaoLidas })}
        className="relative rounded-md p-1.5 text-ink-muted sm:p-2 transition-colors hover:bg-sunken hover:text-ink"
      >
        <Bell className="h-5 w-5" aria-hidden />
        {totalNaoLidas > 0 && (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-[4px] bg-signal px-1 text-[10px] font-bold text-on-signal"
          >
            {totalNaoLidas > 9 ? "9+" : totalNaoLidas}
          </span>
        )}
      </button>

      {aberto && (
        // Em telas estreitas, "absolute right-0" com largura fixa (w-80)
        // estourava a viewport pra esquerda - o botão do sino não fica
        // colado na borda direita (tem o menu do usuário e o alternador
        // de tema depois dele). Vira um painel fixo ancorado na própria
        // tela (não no botão) até o breakpoint sm, onde volta ao
        // posicionamento relativo ao botão de sempre.
        <div className="animate-pop-in fixed inset-x-4 top-16 z-10 origin-top rounded-lg border border-line bg-surface py-1 shadow-md sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-1 sm:w-80 sm:origin-top-right">
          <div className="flex items-center justify-between px-3 py-2">
            <p className="text-sm font-semibold text-ink">{t("titulo")}</p>
            {totalNaoLidas > 0 && (
              <form action={marcarTodasLidas}>
                <button type="submit" className="text-xs font-medium text-brand hover:underline">
                  {t("marcarTodasLidas")}
                </button>
              </form>
            )}
          </div>

          {notificacoes.length === 0 && (
            <p className="px-3 py-4 text-center text-sm text-ink-muted">
              {t("nenhuma")}
            </p>
          )}

          <ul className="max-h-80 overflow-auto">
            {notificacoes.map((notificacao) => {
              const conteudo = (
                <>
                  <p className="text-sm font-medium text-ink">
                    {notificacao.titulo}
                    {!notificacao.lida && <span className="sr-only"> {t("naoLida")}</span>}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">
                    {notificacao.mensagem}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {formatarTempoRelativo(notificacao.createdAt, locale)}
                  </p>
                </>
              );

              return (
                <li
                  key={notificacao.id}
                  className={`border-t border-line px-3 py-2 ${
                    notificacao.lida ? "" : "bg-brand-soft/60"
                  }`}
                >
                  {notificacao.protocolo ? (
                    <Link
                      href={`/reclamacoes/${notificacao.protocolo}`}
                      onClick={() => {
                        setAberto(false);
                        if (!notificacao.lida) {
                          marcarNotificacaoLida(notificacao.id);
                        }
                      }}
                      className="block"
                    >
                      {conteudo}
                    </Link>
                  ) : (
                    <div>{conteudo}</div>
                  )}
                </li>
              );
            })}
          </ul>

          <Link
            href="/painel/notificacoes"
            onClick={() => setAberto(false)}
            className="block border-t border-line px-3 py-2 text-center text-xs font-medium text-brand hover:underline"
          >
            {t("verTodas")}
          </Link>
        </div>
      )}
    </div>
  );
}
