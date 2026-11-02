import Link from "next/link";
import type { StatusReclamacao } from "@prisma/client";
import { Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { CategoriaIcon } from "@/components/reclamacao/categoria-icon";
import { StatusBadge } from "@/components/reclamacao/status-badge";
import { formatarDataHora } from "@/lib/util/formatarData";
import { formatarTempoRelativo } from "@/lib/util/tempo-relativo";

// Cartão de reclamação da lista pública e do feed da cidade (eram duas
// implementações parecidas, mas diferentes: uma sem descrição, outra com).
// Miniatura da foto (versão tratada) ou ícone da categoria à esquerda; o
// protocolo em mono (é o "número da ficha") e o estado em cima; título;
// categoria · local · quando; trecho do texto; e, só quando houver, quantas
// pessoas confirmaram. Sem sombra: só o fio de 1px, que escurece no hover.
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
      className="group flex gap-4 rounded-lg border border-line bg-surface p-4 transition-colors hover:border-ink-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {fotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- imagem externa (Vercel Blob), sem domínio fixo pra configurar no next/image
        <img
          src={fotoUrl}
          alt=""
          className="h-14 w-14 shrink-0 rounded-md border border-line object-cover sm:h-18 sm:w-18"
        />
      ) : (
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-sunken text-ink-muted sm:h-18 sm:w-18">
          <CategoriaIcon icone={categoria.icone} className="h-5 w-5 sm:h-6 sm:w-6" />
        </span>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {/* Celular: o badge vai ACIMA do título. Do lado, ele (e a miniatura)
            deixavam o título numa coluna de ~100px, quebrando em 5-6 linhas. */}
        <div className="flex items-center justify-between gap-3">
          <span className="kicker truncate">{protocolo}</span>
          <StatusBadge status={status} />
        </div>

        <h3 className="text-base leading-snug font-bold text-ink transition-colors group-hover:text-brand">
          {titulo}
        </h3>

        <p className="text-sm text-ink-muted">
          {categoria.nome}
          {local && ` · ${local}`} ·{" "}
          <time dateTime={data.toISOString()} title={formatarDataHora(data, locale)}>
            {formatarTempoRelativo(data, locale)}
          </time>
        </p>

        {descricao && <p className="line-clamp-2 text-sm text-ink-2">{descricao}</p>}

        {confirmacoes > 0 && (
          <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-ink-2">
            <Users className="h-3.5 w-3.5 text-ink-muted" aria-hidden />
            {t("confirmacoes", { count: confirmacoes })}
          </p>
        )}
      </div>
    </Link>
  );
}
