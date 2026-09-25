"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  BarChart3,
  ClipboardList,
  Flag,
  ListChecks,
  MessageSquareOff,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

interface ItemNav {
  href: string;
  chave: string;
  icone: LucideIcon;
}

const ITENS_MODERADOR: ItemNav[] = [
  { href: "/moderacao", chave: "moderacao", icone: ClipboardList },
  { href: "/moderacao/comentarios", chave: "comentarios", icone: MessageSquareOff },
  { href: "/denuncias", chave: "denuncias", icone: Flag },
  { href: "/moderacao/estatisticas", chave: "estatisticas", icone: BarChart3 },
];

const ITENS_ADMIN: ItemNav[] = [
  { href: "/solicitacoes-orgao", chave: "solicitacoes", icone: ShieldCheck },
  { href: "/orgaos-categorias", chave: "categorias", icone: ListChecks },
];

export function AdminNav({ ehAdmin }: { ehAdmin: boolean }) {
  const t = useTranslations("AdminNav");
  const pathname = usePathname();
  const itens = ehAdmin ? [...ITENS_MODERADOR, ...ITENS_ADMIN] : ITENS_MODERADOR;
  const navRef = useRef<HTMLElement>(null);
  const ativoRef = useRef<HTMLAnchorElement>(null);

  // Ao entrar direto numa página (não clicando no menu), a faixa começa
  // rolada pro início - se a aba ativa estiver fora da área visível
  // (telas estreitas), o usuário não tem como saber onde está sem rolar
  // manualmente. Centraliza a aba ativa na faixa sempre que a rota muda.
  useEffect(() => {
    const nav = navRef.current;
    const ativo = ativoRef.current;
    if (!nav || !ativo) return;

    const alvo = ativo.offsetLeft - nav.clientWidth / 2 + ativo.clientWidth / 2;
    nav.scrollLeft = Math.max(0, alvo);
  }, [pathname]);

  return (
    <nav
      ref={navRef}
      // "justify-content: safe center" não tem suporte confiável em flex
      // (o Chromium ignora o valor e volta a alinhar pelo início) - o
      // polyfill é um wrapper interno com "width: max-content" e
      // "min-width: 100%": quando o conteúdo cabe, o wrapper vira do
      // tamanho do nav e o justify-center centraliza normalmente; quando
      // não cabe, o wrapper vira do tamanho do próprio conteúdo (sem
      // sobra), então "centralizar" não corta nada e a rolagem continua
      // alcançando as duas pontas. "relative" faz o nav ser o offsetParent
      // dos links, pro cálculo de auto-scroll abaixo ser preciso.
      className="scrollbar-none relative mb-2 overflow-x-auto border-b border-slate-200 pb-3 dark:border-slate-800"
    >
      <div className="flex w-max min-w-full flex-nowrap justify-center gap-1">
        {itens.map((item) => {
          // "/moderacao" não pode marcar como ativo em "/moderacao/comentarios" -
          // por isso o item raiz exige correspondência exata, os demais aceitam
          // sub-rotas (ex.: /moderacao/historico continua dentro de "Moderação").
          const ativo =
            item.href === "/moderacao"
              ? pathname === "/moderacao" || pathname === "/moderacao/historico"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              ref={ativo ? ativoRef : undefined}
              aria-current={ativo ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                ativo
                  ? "bg-primary text-white"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              <item.icone className="h-3.5 w-3.5" aria-hidden />
              {t(item.chave)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
