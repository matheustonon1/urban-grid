"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { useFecharAoInteragirFora } from "@/hooks/useFecharAoInteragirFora";
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
  const containerRef = useFecharAoInteragirFora<HTMLDivElement>(aberto, () => setAberto(false));

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
        // O texto visível ("PT"/"EN") precisa fazer parte do nome acessível (WCAG
        // 2.5.3): quem comanda por voz diz "clicar PT".
        aria-label={`${t("rotulo")}: ${locale === "pt-BR" ? "PT" : "EN"}`}
        className="flex items-center gap-1 rounded-md p-1.5 text-xs sm:p-2 font-semibold text-ink-2 transition-colors hover:bg-sunken disabled:opacity-50"
      >
        <Languages className="h-5 w-5" aria-hidden />
        <span aria-hidden className="hidden sm:inline">
          {locale === "pt-BR" ? "PT" : "EN"}
        </span>
      </button>

      {aberto && (
        <div className="animate-pop-in absolute right-0 z-10 mt-2 w-36 origin-top-right rounded-lg border border-line bg-surface py-1 shadow-[0_18px_40px_-16px_rgb(14_21_32/0.35)]">
          {IDIOMAS.map((idioma) => (
            <button
              key={idioma}
              type="button"
              onClick={() => escolher(idioma)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-ink-2 hover:bg-sunken"
            >
              {t(idioma)}
              {idioma === locale && (
                <Check className="h-4 w-4 text-brand" aria-hidden />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
