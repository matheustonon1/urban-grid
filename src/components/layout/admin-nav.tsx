"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  BarChart3,
  Ban,
  ClipboardList,
  Flag,
  ListChecks,
  MapPinPlus,
  MessageSquareOff,
  ShieldCheck,
  Users,
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
  { href: "/solicitacoes-cidade", chave: "solicitacoesCidade", icone: MapPinPlus },
  { href: "/orgaos-categorias", chave: "categorias", icone: ListChecks },
  { href: "/banimentos", chave: "banimentos", icone: Ban },
  { href: "/usuarios", chave: "usuarios", icone: Users },
];

export function AdminNav({
  ehAdmin,
  pendentes = {},
}: {
  ehAdmin: boolean;
  // Itens esperando revisão por aba (chave = ItemNav.chave); ausente/0 = sem selo.
  pendentes?: Record<string, number>;
}) {
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

    // Só rola se a aba ativa não estiver inteira à vista - antes centralizava
    // sempre, o que cortava a primeira aba à esquerda mesmo quando tudo cabia.
    const inicio = ativo.offsetLeft;
    const fim = inicio + ativo.clientWidth;
    if (inicio >= nav.scrollLeft && fim <= nav.scrollLeft + nav.clientWidth) return;

    const alvo = inicio - nav.clientWidth / 2 + ativo.clientWidth / 2;
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
      className="scrollbar-none relative mb-2 overflow-x-auto border-b border-line"
    >
      <div className="flex w-max min-w-full flex-nowrap justify-start gap-1">
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
              className={`-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                ativo
                  ? "border-brand text-ink"
                  : "border-transparent text-ink-muted hover:border-line-strong hover:text-ink"
              }`}
            >
              <item.icone className="h-3.5 w-3.5" aria-hidden />
              {t(item.chave)}
              {(pendentes[item.chave] ?? 0) > 0 && (
                <span
                  className="rounded-[4px] bg-signal px-1.5 text-xs leading-5 font-bold text-on-signal tabular-nums"
                >
                  <span aria-hidden>{pendentes[item.chave] > 99 ? "99+" : pendentes[item.chave]}</span>
                  <span className="sr-only"> {t("pendentes", { count: pendentes[item.chave] })}</span>
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
