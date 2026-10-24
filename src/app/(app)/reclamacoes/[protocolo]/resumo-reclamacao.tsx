import type { ReactNode } from "react";
import Link from "next/link";
import type { StatusReclamacao } from "@prisma/client";
import { CalendarDays, MapPin, Users, type LucideIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { CategoriaIcon } from "@/components/reclamacao/categoria-icon";
import { cartaoSecao, rotuloSecao } from "@/lib/estilos";
import { formatarData } from "@/lib/util/formatarData";

import { ProgressoStatus } from "./progresso-status";

function Fato({
  icone,
  rotulo,
  children,
}: {
  icone: ReactNode;
  rotulo: string;
  children: ReactNode;
}) {
  // Só dt e dd dentro do <div>: um <dl> não aceita outro filho (o ícone vai DENTRO do
  // dt, decorativo) - o leitor de tela e a varredura de acessibilidade tratam a lista
  // como pares termo/descrição.
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="flex items-center gap-2 text-xs text-ink-muted">
        <span className="shrink-0">{icone}</span>
        {rotulo}
      </dt>
      <dd className="pl-6 text-sm text-ink">{children}</dd>
    </div>
  );
}

function icone(Icone: LucideIcon) {
  return <Icone className="h-4 w-4" aria-hidden />;
}

// Coluna lateral do detalhe: o essencial da reclamação de relance (onde
// está, de que tipo, desde quando, quantos confirmam) e a ação principal.
// `acao` vem pronto da página porque depende da sessão (confirmar, entrar
// pra confirmar, ou nada pro autor).
export async function ResumoReclamacao({
  status,
  categoria,
  cidade,
  endereco,
  criadaEm,
  confirmacoes,
  locale,
  acao,
  acaoSecundaria,
}: {
  status: StatusReclamacao;
  categoria: { nome: string; icone: string | null };
  cidade: { nome: string; slug: string; uf: string };
  endereco: string;
  criadaEm: Date;
  confirmacoes: number;
  locale: string;
  acao: ReactNode;
  // Ação rara e discreta (denunciar), logo abaixo da principal.
  acaoSecundaria?: ReactNode;
}) {
  const t = await getTranslations("ReclamacaoDetalhe");

  return (
    <section className={`flex flex-col gap-5 ${cartaoSecao}`}>
      <h2 className={rotuloSecao}>{t("resumo")}</h2>

      <ProgressoStatus status={status} />

      <dl className="flex flex-col gap-3.5">
        <Fato
          rotulo={t("categoria")}
          icone={<CategoriaIcon icone={categoria.icone} className="h-4 w-4" />}
        >
          {categoria.nome}
        </Fato>
        <Fato rotulo={t("local")} icone={icone(MapPin)}>
          {endereco}
          <br />
          <Link href={`/cidades/${cidade.slug}`} className="text-brand hover:underline">
            {cidade.nome} - {cidade.uf}
          </Link>
        </Fato>
        <Fato rotulo={t("registradaEm")} icone={icone(CalendarDays)}>
          <span className="tabular-nums">{formatarData(criadaEm, locale)}</span>
        </Fato>
      </dl>

      <div className="flex flex-col gap-3 border-t border-line pt-4">
        <p className="flex items-center gap-2 text-sm font-medium text-ink">
          <Users className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
          {t("pessoasConfirmaram", { count: confirmacoes })}
        </p>
        {acao}
        {acaoSecundaria}
      </div>
    </section>
  );
}
