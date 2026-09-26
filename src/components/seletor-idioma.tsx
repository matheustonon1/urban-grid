"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { definirIdioma } from "@/i18n/actions";
import { IDIOMAS, type Idioma } from "@/i18n/config";

// Dropdown próprio em vez de <select> nativo - o menu nativo do
// navegador (cinza, azul-padrão) destoava completamente do resto da UI,
// que já usa esse mesmo padrão de popover em UserMenu/NotificacoesSino.
export function SeletorIdioma() {
  const t = useTranslations("Idioma");
  const locale = useLocale() as Idioma;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
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

  function escolher(idioma: Idioma) {
    setAberto(false);
    if (idioma === locale) return;
    startTransition(async () => {
      await definirIdioma(idioma);
      router.refresh();
    });
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setAberto((valor) => !valor)}
        disabled={pending}
        aria-expanded={aberto}
        aria-haspopup="true"
        aria-label={t("rotulo")}
        className="flex items-center gap-1 rounded-lg p-2 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Languages className="h-5 w-5" aria-hidden />
        <span aria-hidden>{locale === "pt-BR" ? "PT" : "EN"}</span>
      </button>

      {aberto && (
        <div className="animate-pop-in absolute right-0 z-10 mt-1 w-36 origin-top-right rounded-lg border border-slate-200 bg-white py-1 shadow-md dark:border-slate-700 dark:bg-slate-900">
          {IDIOMAS.map((idioma) => (
            <button
              key={idioma}
              type="button"
              onClick={() => escolher(idioma)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {t(idioma)}
              {idioma === locale && (
                <Check className="h-4 w-4 text-primary" aria-hidden />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
