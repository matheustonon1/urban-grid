"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { definirIdioma } from "@/i18n/actions";
import { IDIOMAS, type Idioma } from "@/i18n/config";

// Sem roteamento por locale - trocar aqui não muda a URL, só o cookie
// que o servidor lê pra decidir qual dicionário usar (ver
// src/i18n/request.ts). router.refresh() força os Server Components a
// renderizar de novo com o idioma novo.
export function SeletorIdioma() {
  const t = useTranslations("Idioma");
  const locale = useLocale() as Idioma;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function aoTrocar(evento: React.ChangeEvent<HTMLSelectElement>) {
    const novoIdioma = evento.target.value as Idioma;
    startTransition(async () => {
      await definirIdioma(novoIdioma);
      router.refresh();
    });
  }

  return (
    <label
      className="relative flex items-center gap-1 rounded-lg p-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      title={t("rotulo")}
    >
      <Languages className="h-5 w-5" aria-hidden />
      <span aria-hidden>{locale === "pt-BR" ? "PT" : "EN"}</span>
      <span className="sr-only">{t("rotulo")}</span>
      <select
        value={locale}
        onChange={aoTrocar}
        disabled={pending}
        aria-label={t("rotulo")}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {IDIOMAS.map((idioma) => (
          <option key={idioma} value={idioma}>
            {t(idioma)}
          </option>
        ))}
      </select>
    </label>
  );
}
