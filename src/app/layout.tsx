import type { Metadata } from "next";
import Link from "next/link";
import { IBM_Plex_Mono, IBM_Plex_Sans, Space_Grotesk } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import "./globals.css";

import { SiteHeader } from "@/components/site-header";

// Space Grotesk nos títulos (geométrica, técnica - remete a planta/grade
// urbana, combina com o nome do produto) + IBM Plex Sans no corpo
// (legibilidade alta, associada a serviços digitais públicos/cívicos) no
// lugar do par Geist/Geist Mono padrão do create-next-app.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return {
    title: "Urban Grid",
    description: t("descricao"),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const messages = await getMessages();
  const t = await getTranslations("Footer");

  return (
    <html
      lang={locale}
      className={`${spaceGrotesk.variable} ${plexSans.variable} ${plexMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("tema");var e=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",e)}catch(e){}})()`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <SiteHeader />
          {children}
          <footer className="flex flex-col items-center gap-1 border-t border-slate-200 py-4 text-center text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
            <span>{t("tcc")}</span>
            <Link href="/transparencia" className="underline hover:text-slate-600 dark:hover:text-slate-300">
              {t("transparencia")}
            </Link>
            <Link href="/termos" className="underline hover:text-slate-600 dark:hover:text-slate-300">
              {t("termos")}
            </Link>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
