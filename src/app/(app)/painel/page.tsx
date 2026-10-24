import Link from "next/link";
import { Bell, ChevronRight, FilePlus, Plus, Rss, User, Users } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/lib/seguranca/sessao";
import { Aviso } from "@/components/ui/aviso";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { BotaoAcao, FormularioAcao } from "@/components/ui/formulario-acao";
import { PainelNumeros } from "@/components/ui/painel-numeros";
import { Secao } from "@/components/ui/secao";
import { StatusBadge } from "@/components/reclamacao/status-badge";
import { Paginacao } from "@/components/ui/paginacao";
import { calcularSkip, calcularTotalPaginas, ITENS_POR_PAGINA, lerPaginaAtual } from "@/lib/util/paginacao";
import {
  botaoPrimario,
  botaoSecundario,
  colunaLateral,
  colunaPrincipal,
  grade,
  pagina,
} from "@/lib/estilos";
import { metadataDaPagina } from "@/lib/metadata";
import { formatarTempoRelativo } from "@/lib/util/tempo-relativo";

import { reenviarVerificacao } from "./actions";

export const generateMetadata = metadataDaPagina("Painel");

export default async function PainelPage({ searchParams }: PageProps<"/painel">) {
  const t = await getTranslations("Painel");
  const tPapel = await getTranslations("Papel");
  const tMenu = await getTranslations("UserMenu");
  const tNotificacoes = await getTranslations("Notificacoes");
  const locale = await getLocale();
  const session = await exigirSessao();

  const { page } = await searchParams;
  const paginaAtual = lerPaginaAtual(page);
  const filtro = { autorId: session.user.id };

  const [reclamacoes, totalReclamacoes, porStatus, confirmacoesRecebidas, usuario] =
    await Promise.all([
      prisma.reclamacao.findMany({
        where: filtro,
        orderBy: { createdAt: "desc" },
        skip: calcularSkip(paginaAtual),
        take: ITENS_POR_PAGINA,
        include: { _count: { select: { confirmacoes: true } } },
      }),
      prisma.reclamacao.count({ where: filtro }),
      prisma.reclamacao.groupBy({ by: ["status"], where: filtro, _count: { _all: true } }),
      prisma.confirmacao.count({ where: { reclamacao: filtro } }),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { emailVerified: true },
      }),
    ]);
  const totalPaginas = calcularTotalPaginas(totalReclamacoes);

  const contagem = (status: string) =>
    porStatus.find((grupo) => grupo.status === status)?._count._all ?? 0;
  const primeiroNome = session.user.name?.trim().split(/\s+/)[0];

  const atalhos = [
    { href: "/painel/notificacoes", rotulo: tNotificacoes("titulo"), icone: Bell },
    { href: "/painel/assinaturas", rotulo: tMenu("assinaturas"), icone: Rss },
    { href: "/painel/conta", rotulo: tMenu("minhaConta"), icone: User },
  ];

  const novaReclamacao = (
    <Link href="/reclamacoes/nova" className={botaoPrimario}>
      <Plus className="h-4 w-4" aria-hidden />
      {t("novaReclamacao")}
    </Link>
  );

  return (
    <main className={pagina}>
      <CabecalhoPagina
        kicker={t("kicker")}
        titulo={primeiroNome ? t("ola", { nome: primeiroNome }) : t("titulo")}
        descricao={`${tPapel(session.user.papel)} · ${session.user.email}`}
        acoes={totalReclamacoes > 0 ? novaReclamacao : undefined}
      />

      {!usuario?.emailVerified && (
        <Aviso
          tom="atencao"
          acao={
            <FormularioAcao action={reenviarVerificacao}>
              <BotaoAcao className={botaoSecundario}>{t("reenviarVerificacao")}</BotaoAcao>
            </FormularioAcao>
          }
        >
          {t("emailNaoVerificado")}
        </Aviso>
      )}

      {totalReclamacoes > 0 && (
        <PainelNumeros
          itens={[
            { rotulo: t("metricaTotal"), valor: String(totalReclamacoes) },
            { rotulo: t("metricaAndamento"), valor: String(contagem("EM_ANDAMENTO")) },
            { rotulo: t("metricaResolvidas"), valor: String(contagem("RESOLVIDA")) },
            { rotulo: t("metricaConfirmacoes"), valor: String(confirmacoesRecebidas) },
          ]}
        />
      )}

      <div className={grade}>
        <div className={colunaPrincipal}>
          <Secao id="minhas" titulo={t("minhasReclamacoes")} contador={totalReclamacoes}>
            {reclamacoes.length === 0 ? (
              <EstadoVazio
                icone={FilePlus}
                titulo={t("nenhumaReclamacao")}
                descricao={t("nenhumaReclamacaoDesc")}
              >
                {novaReclamacao}
              </EstadoVazio>
            ) : (
              <ul className="-mt-2 divide-y divide-line">
                {reclamacoes.map((reclamacao) => (
                  <li key={reclamacao.id}>
                    <Link
                      href={`/reclamacoes/${reclamacao.protocolo}`}
                      className="group flex items-center gap-4 py-4 transition-colors"
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <div className="sm:hidden">
                          <StatusBadge status={reclamacao.status} />
                        </div>
                        <p className="line-clamp-2 font-bold text-ink group-hover:text-brand sm:line-clamp-1">
                          {reclamacao.titulo}
                        </p>
                        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink-muted">
                          <span className="kicker">{reclamacao.protocolo}</span>
                          <span>{formatarTempoRelativo(reclamacao.createdAt, locale)}</span>
                          {reclamacao._count.confirmacoes > 0 && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" aria-hidden />
                              <span className="tabular-nums">{reclamacao._count.confirmacoes}</span>
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="hidden sm:block">
                        <StatusBadge status={reclamacao.status} />
                      </div>
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-brand"
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <Paginacao paginaAtual={paginaAtual} totalPaginas={totalPaginas} basePath="/painel" />
          </Secao>
        </div>

        <aside className={colunaLateral}>
          <Secao id="atalhos" titulo={t("atalhos")}>
            <ul className="-mt-2 divide-y divide-line">
              {atalhos.map(({ href, rotulo, icone: Icone }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="group flex items-center gap-3 py-3.5 text-ink-2 transition-colors hover:text-brand"
                  >
                    <Icone className="h-4 w-4 shrink-0 text-ink-muted group-hover:text-brand" aria-hidden />
                    <span className="flex-1 font-medium">{rotulo}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </Secao>
        </aside>
      </div>
    </main>
  );
}
