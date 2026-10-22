import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import "./globals.css";

import { Rodape } from "@/components/layout/rodape";
import { SiteHeader } from "@/components/layout/site-header";

// Archivo nos títulos: grotesca de placa de rua, firme e sem enfeite. IBM Plex
// Sans no corpo (legibilidade alta, associada a serviços digitais públicos) e
// Plex Mono para protocolo e números. Nenhuma é o par Geist/Geist Mono padrão do
// create-next-app. Archivo é variável: sem `weight`, entram todos os pesos.
const archivo = Archivo({
  variable: "--font-display",
  subsets: ["latin"],
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
    // Cada página define só o próprio título; o sufixo vem daqui.
    title: { default: "Urban Grid", template: "%s · Urban Grid" },
    description: t("descricao"),
  };
}

// A barra do navegador no celular acompanha o papel do tema.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f4f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f16" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const messages = await getMessages();
  const t = await getTranslations("Header");

  return (
    <html
      lang={locale}
      className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable} h-full antialiased`}
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
          <a
            href="#conteudo"
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-paper"
          >
            {t("pularConteudo")}
          </a>
          <SiteHeader />
          {/* Alvo do "pular para o conteúdo". Cada página tem o próprio <main>;
              este contêiner só dá o ponto de foco e mantém o rodapé embaixo. */}
          <div id="conteudo" tabIndex={-1} className="flex flex-1 flex-col outline-none">
            {children}
          </div>
          <Rodape />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
