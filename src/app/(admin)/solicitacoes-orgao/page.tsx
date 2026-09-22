import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { Paginacao } from "@/components/paginacao";
import { calcularSkip, calcularTotalPaginas, ITENS_POR_PAGINA, lerPaginaAtual } from "@/lib/paginacao";
import { botaoPrimario, botaoSecundario, campoInput, cartao, containerPagina } from "@/lib/estilos";

import { aprovarSolicitacao, rejeitarSolicitacao } from "./actions";
import { exigirAdmin } from "./exigir-admin";

const STATUS_LABEL: Record<string, string> = {
  APROVADA: "Aprovada",
  REJEITADA: "Rejeitada",
};

const STATUS_COR: Record<string, string> = {
  APROVADA: "text-green-700 dark:text-green-400",
  REJEITADA: "text-red-700 dark:text-red-400",
};

export default async function SolicitacoesOrgaoPage({
  searchParams,
}: PageProps<"/solicitacoes-orgao">) {
  await exigirAdmin();

  const { pagePendentes, pageDecididas } = await searchParams;
  const paginaPendentes = lerPaginaAtual(pagePendentes);
  const paginaDecididas = lerPaginaAtual(pageDecididas);
  const filtroDecididas = { status: { not: "PENDENTE" as const } };

  const [pendentes, totalPendentes, decididasRecentemente, totalDecididas] = await Promise.all([
    prisma.solicitacaoOrgao.findMany({
      where: { status: "PENDENTE" },
      orderBy: { createdAt: "asc" },
      include: { cidade: { include: { estado: true } } },
      skip: calcularSkip(paginaPendentes),
      take: ITENS_POR_PAGINA,
    }),
    prisma.solicitacaoOrgao.count({ where: { status: "PENDENTE" } }),
    prisma.solicitacaoOrgao.findMany({
      where: filtroDecididas,
      orderBy: { analisadoEm: "desc" },
      skip: calcularSkip(paginaDecididas),
      take: ITENS_POR_PAGINA,
      include: { cidade: true, analisadoPor: true },
    }),
    prisma.solicitacaoOrgao.count({ where: filtroDecididas }),
  ]);
  const totalPaginasPendentes = calcularTotalPaginas(totalPendentes);
  const totalPaginasDecididas = calcularTotalPaginas(totalDecididas);

  return (
    <main className={`${containerPagina} max-w-3xl`}>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        Solicitações de acesso como órgão
      </h1>

      {pendentes.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Nenhuma solicitação pendente.
        </p>
      )}

      {pendentes.map((solicitacao) => (
        <div key={solicitacao.id} className={`flex flex-col gap-2 ${cartao}`}>
          <p className="font-medium text-slate-900 dark:text-slate-100">
            {solicitacao.nomeOrgao}
            {solicitacao.sigla && ` (${solicitacao.sigla})`}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {solicitacao.cidade.nome} - {solicitacao.cidade.estado.uf}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Responsável: {solicitacao.nomeResponsavel} · {solicitacao.email}
            {solicitacao.telefone && ` · ${solicitacao.telefone}`}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Enviado em {solicitacao.createdAt.toLocaleString("pt-BR")}
          </p>

          <div className="flex items-start gap-2">
            <form action={aprovarSolicitacao.bind(null, solicitacao.id)}>
              <button type="submit" className={botaoPrimario}>
                Aprovar
              </button>
            </form>

            <form
              action={rejeitarSolicitacao.bind(null, solicitacao.id)}
              className="flex flex-1 gap-2"
            >
              <textarea
                name="motivo"
                required
                minLength={10}
                placeholder="Motivo da rejeição"
                rows={1}
                className={`flex-1 ${campoInput}`}
              />
              <button type="submit" className={botaoSecundario}>
                Rejeitar
              </button>
            </form>
          </div>
        </div>
      ))}

      <Paginacao
        paginaAtual={paginaPendentes}
        totalPaginas={totalPaginasPendentes}
        basePath="/solicitacoes-orgao"
        paramName="pagePendentes"
        searchParams={{
          pageDecididas: typeof pageDecididas === "string" ? pageDecididas : undefined,
        }}
      />

      {decididasRecentemente.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Decididas recentemente {totalDecididas > 0 && `(${totalDecididas})`}
          </h2>
          {decididasRecentemente.map((solicitacao) => (
            <div key={solicitacao.id} className={`flex flex-col gap-1 ${cartao}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {solicitacao.nomeOrgao}
                  {solicitacao.sigla && ` (${solicitacao.sigla})`} · {solicitacao.cidade.nome}
                </p>
                <span className={`text-sm font-medium ${STATUS_COR[solicitacao.status]}`}>
                  {STATUS_LABEL[solicitacao.status]}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {solicitacao.email} · por{" "}
                {solicitacao.analisadoPor?.name ?? solicitacao.analisadoPor?.email ?? "—"} em{" "}
                {solicitacao.analisadoEm?.toLocaleString("pt-BR")}
              </p>
              {solicitacao.motivoRejeicao && (
                <p className="text-sm italic text-slate-600 dark:text-slate-400">
                  “{solicitacao.motivoRejeicao}”
                </p>
              )}
            </div>
          ))}

          <Paginacao
            paginaAtual={paginaDecididas}
            totalPaginas={totalPaginasDecididas}
            basePath="/solicitacoes-orgao"
            paramName="pageDecididas"
            searchParams={{
              pagePendentes: typeof pagePendentes === "string" ? pagePendentes : undefined,
            }}
          />
        </div>
      )}

      <Link href="/cadastro?tipo=orgao" className="text-sm text-primary underline">
        Ver formulário público de solicitação
      </Link>
    </main>
  );
}
