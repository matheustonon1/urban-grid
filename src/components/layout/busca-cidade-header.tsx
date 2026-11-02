"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { SeletorCidade } from "@/components/formulario/cidade-combobox";

export function BuscaCidadeHeader() {
  const t = useTranslations("Header");
  const router = useRouter();

  return (
    <div className="hidden max-w-xs flex-1 sm:block">
      <SeletorCidade
        name="cidadeId"
        placeholder={t("buscarCidade")}
        variante="cabecalho"
        onSelecionar={(cidade) => {
          if (cidade.slug) {
            router.push(`/cidades/${cidade.slug}`);
          }
        }}
      />
    </div>
  );
}

// Abaixo de sm, o campo acima fica oculto (não cabe ao lado da logo e dos
// ícones) e não sobrava nenhum outro jeito de buscar cidade no mobile -
// vira um botão de lupa que abre o mesmo combobox num painel suspenso,
// ocupando a largura toda. Precisa que o <header> pai tenha
// "position: relative" pro "absolute inset-x-0 top-full" se ancorar nele.
export function BuscaCidadeMobile() {
  const t = useTranslations("Header");
  const router = useRouter();
  const [aberto, setAberto] = useState(false);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setAberto((valor) => !valor)}
        aria-expanded={aberto}
        aria-label={aberto ? t("buscarCidadeFechar") : t("buscarCidadeAbrir")}
        className="rounded-md p-1.5 text-ink-muted sm:p-2 transition-colors hover:bg-sunken hover:text-ink"
      >
        {aberto ? <X className="h-5 w-5" aria-hidden /> : <Search className="h-5 w-5" aria-hidden />}
      </button>

      {aberto && (
        <div className="animate-pop-in absolute inset-x-0 top-full z-10 origin-top border-b border-line bg-surface p-3 shadow-md">
          <SeletorCidade
            name="cidadeId"
            placeholder={t("buscarCidade")}
            onSelecionar={(cidade) => {
              setAberto(false);
              if (cidade.slug) {
                router.push(`/cidades/${cidade.slug}`);
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
