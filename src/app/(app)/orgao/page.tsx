import Link from "next/link";
import { StatusReclamacao } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/status-badge";
import { Paginacao } from "@/components/paginacao";
import { calcularSkip, calcularTotalPaginas, ITENS_POR_PAGINA, lerPaginaAtual } from "@/lib/paginacao";
import { botaoPrimario, campoInput, cartao, containerPagina } from "@/lib/estilos";
import { SELO_LABEL_PT, calcularMetricasOrgao, classificarIndice } from "@/lib/reputacaoOrgao";

import { responderReclamacao } from "../reclamacoes/[protocolo]/actions";
import { exigirOrgao } from "../reclamacoes/[protocolo]/exigir-orgao";

function Metrica({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">{valor}</span>
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
    </div>
  );
}

export default async function PainelOrgaoPage({ searchParams }: PageProps<"/orgao">) {
  const session = await exigirOrgao();

  const { pagePendentes, pageHistorico } = await searchParams;
  const paginaPendentes = lerPaginaAtual(pagePendentes);
  const paginaHistorico = lerPaginaAtual(pageHistorico);

  const orgao = await prisma.orgao.findUnique({
    where: { id: session.user.orgaoId! },
    include: { categorias: { select: { id: true, nome: true } } },
  });

  // categoriasIds null = orgao sem categoria atribuida, atende qualquer
  // uma da cidade (ver orgaoAtendeCategoria em lib/orgaoCategoria.ts).
  const categoriaIds =
    orgao && orgao.categorias.length > 0 ? orgao.categorias.map((c) => c.id) : null;

  const filtroPendentes = orgao
    ? {
        cidadeId: orgao.cidadeId,
        status: {
          in: [StatusReclamacao.PUBLICADA, StatusReclamacao.EM_ANDAMENTO],
        },
        ...(categoriaIds ? { categoriaId: { in: categoriaIds } } : {}),
      }
    : null;

  const [pendentes, totalPendentes, metricas, historico, totalHistorico] = await Promise.all([
    filtroPendentes
      ? prisma.reclamacao.findMany({
          where: filtroPendentes,
          orderBy: { publicadaEm: "asc" },
          include: { categoria: true },
          skip: calcularSkip(paginaPendentes),
          take: ITENS_POR_PAGINA,
        })
      : Promise.resolve([]),
    filtroPendentes ? prisma.reclamacao.count({ where: filtroPendentes }) : Promise.resolve(0),
    orgao
      ? calcularMetricasOrgao(orgao.id)
      : Promise.resolve(null),
    orgao
      ? prisma.respostaOficial.findMany({
          where: { orgaoId: orgao.id },
          orderBy: { createdAt: "desc" },
          distinct: ["reclamacaoId"],
          skip: calcularSkip(paginaHistorico),
          take: ITENS_POR_PAGINA,
          include: {
            reclamacao: {
              select: {
                titulo: true,
                protocolo: true,
                status: true,
                avaliacao: { select: { nota: true, resolvido: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
    orgao
      ? prisma.respostaOficial
          .findMany({ where: { orgaoId: orgao.id }, distinct: ["reclamacaoId"], select: { id: true } })
          .then((linhas) => linhas.length)
      : Promise.resolve(0),
  ]);
  const totalPaginasPendentes = calcularTotalPaginas(totalPendentes);
  const totalPaginasHistorico = calcularTotalPaginas(totalHistorico);

  const classificacao = metricas
    ? classificarIndice(metricas.indiceResolucao, metricas.totalRespondidas)
    : null;

  return (
    <main className={`${containerPagina} max-w-3xl`}>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Painel do órgão{orgao ? ` — ${orgao.nome}` : ""}
        </h1>
        {orgao && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {categoriaIds
              ? `Atende: ${orgao.categorias.map((c) => c.nome).join(", ")}`
              : "Atende todas as categorias desta cidade (nenhuma categoria específica atribuída)."}
          </p>
        )}
      </div>

      {orgao && metricas && classificacao && (
        <div className={`flex flex-col gap-3 ${cartao}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className={`inline-block w-fit rounded-full px-2 py-0.5 text-xs font-medium ${classificacao.className}`}
              >
                {SELO_LABEL_PT[classificacao.chave]}
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                sua reputação pública
              </span>
            </div>
            <Link href={`/orgaos/${orgao.id}`} className="text-sm text-primary underline">
              Ver como os cidadãos veem
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Metrica
              label="Resolvidas"
              valor={metricas.indiceResolucao !== null ? `${metricas.indiceResolucao}%` : "—"}
            />
            <Metrica
              label="Tempo médio de resposta"
              valor={
                metricas.tempoMedioRespostaDias !== null
                  ? `${metricas.tempoMedioRespostaDias}d`
                  : "—"
              }
            />
            <Metrica
              label="Nota dos cidadãos"
              valor={metricas.notaMedia !== null ? `${metricas.notaMedia}/5` : "—"}
            />
            <Metrica label="Avaliações recebidas" valor={String(metricas.totalAvaliacoes)} />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Pendentes de resposta {totalPendentes > 0 && `(${totalPendentes})`}
        </h2>

        {pendentes.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nenhuma reclamação pendente de resposta no momento.
          </p>
        )}

        {pendentes.map((reclamacao) => (
          <div key={reclamacao.id} className={`flex flex-col gap-2 ${cartao}`}>
            <p className="font-medium text-slate-900 dark:text-slate-100">{reclamacao.titulo}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {reclamacao.protocolo} · {reclamacao.categoria.nome} · {reclamacao.endereco}
            </p>
            <p className="text-slate-700 dark:text-slate-300">{reclamacao.descricao}</p>

            <form
              action={responderReclamacao.bind(null, reclamacao.id, reclamacao.protocolo)}
              className="flex flex-col gap-2"
            >
              <textarea
                name="texto"
                required
                minLength={10}
                placeholder="Resposta oficial"
                rows={3}
                className={campoInput}
              />
              <select name="novoStatus" defaultValue="" className={campoInput}>
                <option value="">Manter status atual</option>
                <option value="EM_ANDAMENTO">Marcar como em andamento</option>
                <option value="RESOLVIDA">Marcar como resolvida</option>
              </select>
              <input type="date" name="prazoEstimado" className={campoInput} />
              <button type="submit" className={`${botaoPrimario} w-fit`}>
                Enviar resposta
              </button>
            </form>
          </div>
        ))}

        <Paginacao
          paginaAtual={paginaPendentes}
          totalPaginas={totalPaginasPendentes}
          basePath="/orgao"
          paramName="pagePendentes"
          searchParams={{
            pageHistorico: typeof pageHistorico === "string" ? pageHistorico : undefined,
          }}
        />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Histórico de respostas {totalHistorico > 0 && `(${totalHistorico})`}
        </h2>

        {historico.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Você ainda não respondeu nenhuma reclamação.
          </p>
        )}

        {historico.map((resposta) => (
          <Link
            key={resposta.id}
            href={`/reclamacoes/${resposta.reclamacao.protocolo}`}
            className={`flex flex-col gap-2 ${cartao} transition hover:border-primary hover:-translate-y-0.5 hover:shadow-md`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-slate-900 dark:text-slate-100">
                {resposta.reclamacao.titulo}
              </p>
              <StatusBadge status={resposta.reclamacao.status} />
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300">{resposta.texto}</p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {resposta.reclamacao.protocolo} · {resposta.createdAt.toLocaleDateString("pt-BR")}
              </p>
              {resposta.reclamacao.avaliacao ? (
                <p
                  className={`text-xs font-medium ${
                    resposta.reclamacao.avaliacao.resolvido
                      ? "text-green-700 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {resposta.reclamacao.avaliacao.resolvido
                    ? "✓ Cidadão confirmou resolução"
                    : "✗ Cidadão diz que não foi resolvido"}{" "}
                  ({resposta.reclamacao.avaliacao.nota}/5)
                </p>
              ) : (
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Aguardando avaliação do cidadão
                </p>
              )}
            </div>
          </Link>
        ))}

        <Paginacao
          paginaAtual={paginaHistorico}
          totalPaginas={totalPaginasHistorico}
          basePath="/orgao"
          paramName="pageHistorico"
          searchParams={{
            pagePendentes: typeof pagePendentes === "string" ? pagePendentes : undefined,
          }}
        />
      </div>
    </main>
  );
}
