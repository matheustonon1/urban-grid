"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Building2,
  ChevronDown,
  ClipboardList,
  Flag,
  History,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MessageSquareOff,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { sair } from "@/app/(app)/painel/actions";
import { iniciaisDoNome } from "@/lib/texto";

function ItemMenu({
  href,
  icone: Icone,
  onClick,
  children,
}: {
  href: string;
  icone: LucideIcon;
  onClick: () => void;
  children: string;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      <Icone className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
      {children}
    </Link>
  );
}

function TituloSecao({ children }: { children: string }) {
  return (
    <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
      {children}
    </p>
  );
}

export function UserMenu({
  nome,
  email,
  ehModerador,
  ehOrgao,
  ehAdmin,
}: {
  nome: string;
  email: string;
  ehModerador: boolean;
  ehOrgao: boolean;
  ehAdmin: boolean;
}) {
  const t = useTranslations("UserMenu");
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function aoClicarFora(evento: MouseEvent) {
      if (!containerRef.current?.contains(evento.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  const iniciais = iniciaisDoNome(nome);
  const fechar = () => setAberto(false);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setAberto((valor) => !valor)}
        aria-expanded={aberto}
        className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white dark:bg-blue-600">
          {iniciais}
        </span>
        <span className="hidden max-w-40 truncate sm:inline">{nome}</span>
        <ChevronDown className="h-4 w-4 text-slate-400 dark:text-slate-500" aria-hidden />
      </button>

      {aberto && (
        <div className="animate-pop-in absolute right-0 z-10 mt-1 w-64 origin-top-right rounded-lg border border-slate-200 bg-white py-1 shadow-md dark:border-slate-700 dark:bg-slate-900">
          <p className="truncate px-3 py-2 text-xs text-slate-400 dark:text-slate-500">{email}</p>

          <ItemMenu href="/painel" icone={LayoutDashboard} onClick={fechar}>
            {t("painel")}
          </ItemMenu>
          <ItemMenu href="/painel/conta" icone={User} onClick={fechar}>
            {t("minhaConta")}
          </ItemMenu>
          {ehOrgao && (
            <ItemMenu href="/orgao" icone={Building2} onClick={fechar}>
              {t("painelOrgao")}
            </ItemMenu>
          )}

          {ehModerador && (
            <>
              <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
              <TituloSecao>{t("moderacao")}</TituloSecao>
              <ItemMenu href="/moderacao" icone={ClipboardList} onClick={fechar}>
                {t("filaModeracao")}
              </ItemMenu>
              <ItemMenu href="/moderacao/historico" icone={History} onClick={fechar}>
                {t("historicoModeracao")}
              </ItemMenu>
              <ItemMenu href="/moderacao/comentarios" icone={MessageSquareOff} onClick={fechar}>
                {t("comentariosReprovados")}
              </ItemMenu>
              <ItemMenu href="/moderacao/estatisticas" icone={BarChart3} onClick={fechar}>
                {t("estatisticasModeracao")}
              </ItemMenu>
              <ItemMenu href="/denuncias" icone={Flag} onClick={fechar}>
                {t("denuncias")}
              </ItemMenu>
            </>
          )}

          {ehAdmin && (
            <>
              <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
              <TituloSecao>{t("administracao")}</TituloSecao>
              <ItemMenu href="/solicitacoes-orgao" icone={Building2} onClick={fechar}>
                {t("solicitacoesOrgao")}
              </ItemMenu>
              <ItemMenu href="/orgaos-categorias" icone={ListChecks} onClick={fechar}>
                {t("categoriasPorOrgao")}
              </ItemMenu>
            </>
          )}

          <form action={sair} className="mt-1 border-t border-slate-100 dark:border-slate-800">
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-red-600 hover:bg-slate-50 dark:text-red-400 dark:hover:bg-slate-800"
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden />
              {t("sair")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
