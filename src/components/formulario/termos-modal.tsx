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
        className="text-brand underline"
      >
        {t("linkTexto")}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="termos-modal-titulo"
        onClick={(evento) => {
          if (evento.target === dialogRef.current) {
            dialogRef.current?.close();
          }
        }}
        className="animate-pop-in m-auto w-full max-w-2xl rounded-lg border border-line bg-surface p-0 shadow-xl backdrop:bg-night/60"
      >
        <div className="flex max-h-[80vh] flex-col">
          <div className="flex items-center justify-between border-b border-line p-4">
            <h2 id="termos-modal-titulo" className="font-semibold text-ink">
              {tFooter("termos")}
            </h2>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label={t("fechar")}
              className="rounded-lg p-1 text-ink-muted hover:bg-sunken hover:text-ink-2"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <div className="overflow-y-auto p-4">
            <TermosConteudo />
          </div>

          <div className="border-t border-line p-4">
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
