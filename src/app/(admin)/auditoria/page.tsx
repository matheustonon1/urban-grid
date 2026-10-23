import { ScrollText } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Etiqueta, type TomEtiqueta } from "@/components/ui/etiqueta";
import { Paginacao } from "@/components/ui/paginacao";
import { ResumoLateral } from "@/components/ui/resumo-lateral";
import { Secao } from "@/components/ui/secao";
import { colunaLateral, colunaPrincipal, grade, pagina } from "@/lib/estilos";
import { metadataDaPagina } from "@/lib/metadata";
import { formatarData, formatarDataHora } from "@/lib/util/formatarData";
import { calcularSkip, calcularTotalPaginas, ITENS_POR_PAGINA, lerPaginaAtual } from "@/lib/util/paginacao";

import { exigirAdmin } from "../solicitacoes-orgao/exigir-admin";

export const generateMetadata = metadataDaPagina("Auditoria");

const TOM_ACAO = {
  PAPEL_ALTERADO: "info",
  BANIMENTO_APLICADO: "erro",
  BANIMENTO_REVERTIDO: "sucesso",
  ORGAO_DESATIVADO: "atencao",
  ORGAO_REATIVADO: "sucesso",
  SOLICITACAO_ORGAO_APROVADA: "sucesso",
  SOLICITACAO_ORGAO_REJEITADA: "neutro",
  SOLICITACAO_CIDADE_APROVADA: "sucesso",
  SOLICITACAO_CIDADE_REJEITADA: "neutro",
} as const satisfies Record<string, TomEtiqueta>;

const GRUPO_PAPEIS = ["PAPEL_ALTERADO"] as const;
const GRUPO_BANIMENTOS = ["BANIMENTO_APLICADO", "BANIMENTO_REVERTIDO"] as const;
const GRUPO_ORGAOS = [
  "ORGAO_DESATIVADO",
  "ORGAO_REATIVADO",
  "SOLICITACAO_ORGAO_APROVADA",
  "SOLICITACAO_ORGAO_REJEITADA",
  "SOLICITACAO_CIDADE_APROVADA",
  "SOLICITACAO_CIDADE_REJEITADA",
] as const;

const DIA_MS = 86_400_000;

const nomeDaConta = (conta: { name: string | null; email: string } | null) =>
  conta ? (conta.name ?? conta.email) : null;

function lerDetalhes(detalhes: unknown): Record<string, unknown> {
  return detalhes && typeof detalhes === "object" && !Array.isArray(detalhes)
    ? (detalhes as Record<string, unknown>)
    : {};
}

export default async function AuditoriaPage({ searchParams }: PageProps<"/auditoria">) {
  const t = await getTranslations("Auditoria");
  const tPapel = await getTranslations("Papel");
  const locale = await getLocale();
  await exigirAdmin();

  const { page } = await searchParams;
  const paginaAtual = lerPaginaAtual(page);
  const desde = new Date(new Date().getTime() - 7 * DIA_MS);

  const [registros, total, recentes, porAcao] = await Promise.all([
    prisma.registroAuditoria.findMany({
      orderBy: { createdAt: "desc" },
      skip: calcularSkip(paginaAtual),
      take: ITENS_POR_PAGINA,
      include: {
        ator: { select: { name: true, email: true } },
        alvoUser: { select: { name: true, email: true } },
      },
    }),
    prisma.registroAuditoria.count(),
    prisma.registroAuditoria.count({ where: { createdAt: { gte: desde } } }),
    prisma.registroAuditoria.groupBy({ by: ["acao"], _count: { _all: true } }),
  ]);
  const totalPaginas = calcularTotalPaginas(total);
  const contagem = new Map(porAcao.map((linha) => [linha.acao, linha._count._all]));
  const somar = (acoes: readonly (keyof typeof TOM_ACAO)[]) =>
    acoes.reduce((soma, acao) => soma + (contagem.get(acao) ?? 0), 0);

  // Alvos que não são conta: o nome vem do registro de origem (nada de dado pessoal é
  // copiado para a auditoria). Uma consulta por tipo, não uma por linha.
  const idsDe = (tipo: string) =>
    registros.filter((r) => r.alvoTipo === tipo && r.alvoId).map((r) => r.alvoId as string);
  const [orgaos, solicitacoesOrgao, solicitacoesCidade] = await Promise.all([
    idsDe("ORGAO").length
      ? prisma.orgao.findMany({ where: { id: { in: idsDe("ORGAO") } }, select: { id: true, nome: true } })
      : [],
    idsDe("SOLICITACAO_ORGAO").length
      ? prisma.solicitacaoOrgao.findMany({
          where: { id: { in: idsDe("SOLICITACAO_ORGAO") } },
          select: { id: true, nomeOrgao: true },
        })
      : [],
    idsDe("SOLICITACAO_CIDADE").length
      ? prisma.solicitacaoCidade.findMany({
          where: { id: { in: idsDe("SOLICITACAO_CIDADE") } },
          select: { id: true, nomeCidade: true },
        })
      : [],
  ]);
  const nomesDeAlvo = new Map<string, string>([
    ...orgaos.map((o) => [o.id, o.nome] as const),
    ...solicitacoesOrgao.map((s) => [s.id, s.nomeOrgao] as const),
    ...solicitacoesCidade.map((s) => [s.id, s.nomeCidade] as const),
  ]);

  return (
    <main className={pagina}>
      <CabecalhoPagina kicker={t("kicker")} titulo={t("titulo")} descricao={t("descricao")} />

      <div className={grade}>
        <div className={colunaPrincipal}>
          <Secao id="registros" titulo={t("secao")} contador={total}>
            {registros.length === 0 && (
              <EstadoVazio icone={ScrollText} titulo={t("vazio")} descricao={t("vazioDesc")} />
            )}

            {registros.length > 0 && (
              <ul className="-mt-2 divide-y divide-line">
                {registros.map((registro) => {
                  const detalhes = lerDetalhes(registro.detalhes);
                  const alvo =
                    nomeDaConta(registro.alvoUser) ??
                    (registro.alvoId ? nomesDeAlvo.get(registro.alvoId) : undefined) ??
                    (registro.alvoUserId || registro.alvoId ? t("alvoRemovido") : null);

                  let detalhe: string | null = null;
                  if (registro.acao === "PAPEL_ALTERADO") {
                    detalhe = t("detalhePapel", {
                      de: tPapel(String(detalhes.de)),
                      para: tPapel(String(detalhes.para)),
                    });
                  } else if (registro.acao === "BANIMENTO_APLICADO") {
                    const duracao = String(detalhes.duracao);
                    detalhe = t("detalheBanimento", {
                      duracao:
                        duracao === "permanente"
                          ? t("duracaoPermanente")
                          : duracao === "30"
                            ? t("duracao30")
                            : t("duracao7"),
                      ate: formatarData(new Date(String(detalhes.ate)), locale),
                    });
                  }

                  return (
                    <li key={registro.id} className="flex flex-col gap-1.5 py-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Etiqueta tom={TOM_ACAO[registro.acao]}>{t(`acao.${registro.acao}`)}</Etiqueta>
                        <time
                          dateTime={registro.createdAt.toISOString()}
                          className="font-mono text-xs text-ink-muted tabular-nums"
                        >
                          {formatarDataHora(registro.createdAt, locale)}
                        </time>
                      </div>
                      {alvo && <p className="font-bold text-ink">{alvo}</p>}
                      <p className="text-sm text-ink-muted">
                        {detalhe && <span className="text-ink-2">{detalhe} · </span>}
                        {t("por", { ator: nomeDaConta(registro.ator) ?? t("atorRemovido") })}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}

            <Paginacao paginaAtual={paginaAtual} totalPaginas={totalPaginas} basePath="/auditoria" />
          </Secao>
        </div>

        <aside className={colunaLateral}>
          <ResumoLateral
            rotulo={t("resumoRotulo")}
            valor={total}
            itens={[
              { rotulo: t("resumoUltimos7dias"), valor: recentes },
              { rotulo: t("resumoPapeis"), valor: somar(GRUPO_PAPEIS) },
              { rotulo: t("resumoBanimentos"), valor: somar(GRUPO_BANIMENTOS) },
              { rotulo: t("resumoOrgaos"), valor: somar(GRUPO_ORGAOS) },
            ]}
          />
        </aside>
      </div>
    </main>
  );
}
