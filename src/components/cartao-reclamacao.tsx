import Link from "next/link";
import type { StatusReclamacao } from "@prisma/client";
import { Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { CategoriaIcon } from "@/components/categoria-icon";
import { StatusBadge } from "@/components/status-badge";
import { formatarDataHora } from "@/lib/formatarData";
import { formatarTempoRelativo } from "@/lib/tempo-relativo";

// Cartão de reclamação da lista pública e do feed da cidade (eram duas
// implementações parecidas, mas diferentes: uma sem descrição, outra com).
// Miniatura da foto (versão tratada) ou ícone da categoria à esquerda; título
// e estado em cima; categoria · local · quando; trecho do texto; e, só quando
// houver, quantas pessoas confirmaram.
export function CartaoReclamacao({
  protocolo,
  titulo,
  status,
  categoria,
  local,
  descricao,
  fotoUrl,
  confirmacoes,
  data,
}: {
  protocolo: string;
  titulo: string;
  status: StatusReclamacao;
  categoria: { nome: string; icone: string | null };
  // Cidade (lista geral) ou bairro (feed da cidade) - o que situa a reclamação.
  local?: string | null;
  descricao?: string;
  fotoUrl?: string | null;
  confirmacoes: number;
  data: Date;
}) {
  const t = useTranslations("Reclamacoes");
  const locale = useLocale();

  return (
    <Link
      href={`/reclamacoes/${protocolo}`}
      className="group flex gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-400/50"
    >
      {fotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- imagem externa (Vercel Blob), sem domínio fixo pra configurar no next/image
        <img
          src={fotoUrl}
          alt=""
          className="h-12 w-12 shrink-0 rounded-lg border border-slate-200 object-cover sm:h-16 sm:w-16 dark:border-slate-700"
        />
      ) : (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400 sm:h-16 sm:w-16 dark:bg-slate-800 dark:text-slate-500">
          <CategoriaIcon icone={categoria.icone} className="h-5 w-5 sm:h-6 sm:w-6" />
        </span>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {/* Celular: o badge vai ACIMA do título. Do lado, ele (e a miniatura)
            deixavam o título numa coluna de ~100px, quebrando em 5-6 linhas. */}
        <div className="sm:hidden">
          <StatusBadge status={status} />
        </div>
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold leading-snug text-slate-900 transition-colors group-hover:text-primary dark:text-slate-100">
            {titulo}
          </h3>
          <div className="hidden sm:block">
            <StatusBadge status={status} />
          </div>
        </div>

        <p className="text-sm text-slate-500 dark:text-slate-400">
          {categoria.nome}
          {local && ` · ${local}`} ·{" "}
          <time dateTime={data.toISOString()} title={formatarDataHora(data, locale)}>
            {formatarTempoRelativo(data, locale)}
          </time>
        </p>

        {descricao && (
          <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{descricao}</p>
        )}

        {confirmacoes > 0 && (
          <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
            <Users className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" aria-hidden />
            {t("confirmacoes", { count: confirmacoes })}
          </p>
        )}
      </div>
    </Link>
  );
}
