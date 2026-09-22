"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  Flag,
  ListChecks,
  MessageSquareOff,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ItemNav {
  href: string;
  label: string;
  icone: LucideIcon;
}

const ITENS_MODERADOR: ItemNav[] = [
  { href: "/moderacao", label: "Moderação", icone: ClipboardList },
  { href: "/moderacao/comentarios", label: "Comentários", icone: MessageSquareOff },
  { href: "/denuncias", label: "Denúncias", icone: Flag },
  { href: "/moderacao/estatisticas", label: "Estatísticas", icone: BarChart3 },
];

const ITENS_ADMIN: ItemNav[] = [
  { href: "/solicitacoes-orgao", label: "Solicitações", icone: ShieldCheck },
  { href: "/orgaos-categorias", label: "Categorias", icone: ListChecks },
];

export function AdminNav({ ehAdmin }: { ehAdmin: boolean }) {
  const pathname = usePathname();
  const itens = ehAdmin ? [...ITENS_MODERADOR, ...ITENS_ADMIN] : ITENS_MODERADOR;

  return (
    <nav className="scrollbar-none mb-2 flex flex-nowrap gap-1 overflow-x-auto border-b border-slate-200 pb-3 dark:border-slate-800">
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
            aria-current={ativo ? "page" : undefined}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              ativo
                ? "bg-primary text-white"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            <item.icone className="h-3.5 w-3.5" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
