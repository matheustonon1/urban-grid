"use client";

import { useState } from "react";
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
  Rss,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { sair } from "@/app/(app)/painel/actions";
import { useFecharAoInteragirFora } from "@/hooks/useFecharAoInteragirFora";
import { iniciaisDoNome } from "@/lib/util/texto";

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
      className="flex items-center gap-2.5 px-3 py-2 text-sm text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
    >
      <Icone className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
      {children}
    </Link>
  );
}

function TituloSecao({ children }: { children: string }) {
  return <p className="kicker px-3 pt-3 pb-1">{children}</p>;
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
  const containerRef = useFecharAoInteragirFora<HTMLDivElement>(aberto, () => setAberto(false));

  const iniciais = iniciaisDoNome(nome);
  const fechar = () => setAberto(false);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setAberto((valor) => !valor)}
        aria-expanded={aberto}
        className="flex items-center gap-2 rounded-md py-1 pr-2 pl-1 text-sm text-ink-2 transition-colors hover:bg-sunken"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand text-xs font-bold text-on-brand">
          {iniciais}
        </span>
        <span className="hidden max-w-40 truncate font-medium sm:inline">{nome}</span>
        <ChevronDown className="h-4 w-4 text-ink-muted" aria-hidden />
      </button>

      {aberto && (
        <div className="animate-pop-in absolute right-0 z-10 mt-2 w-64 origin-top-right rounded-lg border border-line bg-surface py-1 shadow-[0_18px_40px_-16px_rgb(14_21_32/0.35)]">
          <p className="truncate px-3 py-2 text-xs text-ink-muted">{email}</p>

          <ItemMenu href="/painel" icone={LayoutDashboard} onClick={fechar}>
            {t("painel")}
          </ItemMenu>
          <ItemMenu href="/painel/conta" icone={User} onClick={fechar}>
            {t("minhaConta")}
          </ItemMenu>
          <ItemMenu href="/painel/assinaturas" icone={Rss} onClick={fechar}>
            {t("assinaturas")}
          </ItemMenu>
          {ehOrgao && (
            <ItemMenu href="/orgao" icone={Building2} onClick={fechar}>
              {t("painelOrgao")}
            </ItemMenu>
          )}

          {ehModerador && (
            <>
              <div className="my-1 border-t border-line" />
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
              <div className="my-1 border-t border-line" />
              <TituloSecao>{t("administracao")}</TituloSecao>
              <ItemMenu href="/solicitacoes-orgao" icone={Building2} onClick={fechar}>
                {t("solicitacoesOrgao")}
              </ItemMenu>
              <ItemMenu href="/orgaos-categorias" icone={ListChecks} onClick={fechar}>
                {t("categoriasPorOrgao")}
              </ItemMenu>
            </>
          )}

          <form action={sair} className="mt-1 border-t border-line">
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm font-medium text-danger-ink transition-colors hover:bg-danger-soft"
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
