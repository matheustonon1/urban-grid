"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Link da navegação principal do cabeçalho. Marca a página atual com
// aria-current (leitor de tela) e com a barra amarela embaixo (visão) - o
// cabeçalho é um Server Component e não sabe a rota, por isso este pedacinho
// é cliente.
export function LinkNav({
  href,
  className = "",
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const ativo = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={ativo ? "page" : undefined}
      className={`inline-flex h-full items-center border-b-2 border-transparent px-3 text-sm font-medium text-ink-muted transition-colors hover:text-ink aria-[current=page]:border-signal aria-[current=page]:text-ink ${className}`}
    >
      {children}
    </Link>
  );
}
