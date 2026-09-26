"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { formatarTempoRelativo } from "@/lib/tempo-relativo";

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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function aoClicarFora(evento: MouseEvent) {
      if (!containerRef.current?.contains(evento.target as Node)) {
        setAberto(false);
      }
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setAberto((valor) => !valor)}
        aria-expanded={aberto}
        aria-label={t("titulo")}
        className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      >
        <Bell className="h-5 w-5" aria-hidden />
        {totalNaoLidas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-medium text-white">
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
        <div className="animate-pop-in fixed inset-x-4 top-16 z-10 origin-top rounded-lg border border-slate-200 bg-white py-1 shadow-md sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-1 sm:w-80 sm:origin-top-right dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between px-3 py-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("titulo")}</p>
            {totalNaoLidas > 0 && (
              <form action={marcarTodasLidas}>
                <button type="submit" className="text-xs text-primary hover:underline">
                  {t("marcarTodasLidas")}
                </button>
              </form>
            )}
          </div>

          {notificacoes.length === 0 && (
            <p className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">
              {t("nenhuma")}
            </p>
          )}

          <ul className="max-h-80 overflow-auto">
            {notificacoes.map((notificacao) => {
              const conteudo = (
                <>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {notificacao.titulo}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                    {notificacao.mensagem}
                  </p>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    {formatarTempoRelativo(notificacao.createdAt, locale)}
                  </p>
                </>
              );

              return (
                <li
                  key={notificacao.id}
                  className={`border-t border-slate-100 px-3 py-2 dark:border-slate-800 ${
                    notificacao.lida ? "" : "bg-blue-50/50 dark:bg-blue-950/30"
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
            className="block border-t border-slate-100 px-3 py-2 text-center text-xs font-medium text-primary hover:underline dark:border-slate-800"
          >
            {t("verTodas")}
          </Link>
        </div>
      )}
    </div>
  );
}
