"use client";

import { useRef } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

import { botaoPrimario } from "@/lib/estilos";

import { TermosConteudo } from "./termos-conteudo";

export function TermosModal() {
  const t = useTranslations("TermosModal");
  const tFooter = useTranslations("Footer");
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="text-primary underline"
      >
        {t("linkTexto")}
      </button>

      <dialog
        ref={dialogRef}
        onClick={(evento) => {
          if (evento.target === dialogRef.current) {
            dialogRef.current?.close();
          }
        }}
        className="animate-pop-in m-auto w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-0 shadow-xl backdrop:bg-slate-900/50 dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex max-h-[80vh] flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">
              {tFooter("termos")}
            </h2>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label={t("fechar")}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <div className="overflow-y-auto p-4">
            <TermosConteudo />
          </div>

          <div className="border-t border-slate-200 p-4 dark:border-slate-800">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className={`${botaoPrimario} w-fit`}
            >
              {t("fechar")}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
