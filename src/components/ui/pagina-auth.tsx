import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

import { Marca } from "@/components/ui/marca";

// Moldura das telas de entrada (login, cadastro, redefinir senha, convite de
// órgão...): no desktop, um painel escuro à esquerda diz o que é o produto em
// três linhas e o formulário fica à direita sobre o papel; no celular sobra só
// o formulário. Substitui as seis cópias do mesmo fundo com bolhas flutuantes.
export async function PaginaAuth({
  titulo,
  descricao,
  children,
}: {
  // Omita quando o conteúdo traz o próprio cabeçalho (o cadastro troca de
  // título conforme o tipo de conta).
  titulo?: string;
  descricao?: ReactNode;
  children: ReactNode;
}) {
  const t = await getTranslations("Auth");
  const pontos = [t("ponto1"), t("ponto2"), t("ponto3")];

  return (
    <main className="grid flex-1 lg:grid-cols-[5fr_6fr]">
      <aside
        aria-hidden
        className="relative hidden flex-col justify-between overflow-hidden bg-night p-12 text-chalk lg:flex"
      >
        <div className="bg-planta-clara pointer-events-none absolute inset-0" />

        <Marca tom="claro" className="relative" />

        <div className="relative flex max-w-md flex-col gap-8">
          <p className="font-display text-4xl leading-[1.1] font-extrabold tracking-tight">
            {t("painelTitulo")}
          </p>
          <ul className="flex flex-col gap-4">
            {pontos.map((ponto) => (
              <li key={ponto} className="flex items-start gap-3 text-chalk/80">
                <span className="mt-2 h-2 w-2 shrink-0 rounded-xs bg-signal" />
                <span className="leading-relaxed">{ponto}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="faixa-obra relative -mx-12 -mb-12 h-2" />
      </aside>

      <div className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="animate-fade-in flex w-full max-w-sm flex-col gap-7">
          {titulo && (
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-extrabold tracking-tight text-ink">{titulo}</h1>
              {descricao && <p className="text-ink-muted">{descricao}</p>}
            </div>
          )}
          {children}
        </div>
      </div>
    </main>
  );
}
