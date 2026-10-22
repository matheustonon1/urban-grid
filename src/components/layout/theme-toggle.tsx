"use client";

import { useLayoutEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";

function aplicarTemaSalvo() {
  try {
    const tema = localStorage.getItem("tema");
    const escuro = tema
      ? tema === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", escuro);
  } catch {
    // localStorage indisponível (modo privado, etc.) - mantém o padrão claro
  }
}

export function ThemeToggle() {
  const t = useTranslations("ThemeToggle");

  // Reaplica depois que o Strict Mode do dev remonta <html> e limpa a
  // classe que o script inline do <head> já tinha setado antes do
  // primeiro paint. Não-op em produção.
  useLayoutEffect(() => {
    aplicarTemaSalvo();
  }, []);

  function alternar() {
    const raiz = document.documentElement;
    // Desliga as transicoes de todo mundo por um frame para a troca de
    // classe "dark" nao disparar dezenas de transition-colors ao mesmo
    // tempo (isso que causava a lentidao ao alternar o tema).
    raiz.classList.add("theme-switching");
    const escuro = raiz.classList.toggle("dark");
    try {
      localStorage.setItem("tema", escuro ? "dark" : "light");
    } catch {
      // sem persistência disponível - o toggle ainda funciona na sessão atual
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        raiz.classList.remove("theme-switching");
      });
    });
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={t("alternarTema")}
      className="relative rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
    >
      <Sun
        className="h-5 w-5 rotate-0 opacity-100 transition-all duration-300 dark:-rotate-90 dark:scale-0 dark:opacity-0"
        aria-hidden
      />
      <Moon
        className="absolute inset-0 m-auto h-5 w-5 rotate-90 scale-0 opacity-0 transition-all duration-300 dark:rotate-0 dark:scale-100 dark:opacity-100"
        aria-hidden
      />
    </button>
  );
}
