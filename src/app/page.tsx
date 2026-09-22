import Link from "next/link";
import {
  ArrowRight,
  Award,
  BrainCircuit,
  IdCard,
  Landmark,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { CategoriaIcon } from "@/components/categoria-icon";
import { StatusBadge } from "@/components/status-badge";
import { Revelar } from "@/components/revelar";
import { botaoPrimario, botaoSecundario, cartao } from "@/lib/estilos";
import { calcularMetricasOrgao, classificarIndice } from "@/lib/reputacaoOrgao";

const STATUS_PUBLICOS = [
  "PUBLICADA",
  "EM_ANDAMENTO",
  "RESOLVIDA",
  "ARQUIVADA",
] as const;

const PASSOS = [
  {
    titulo: "1. Registre",
    descricao:
      "Descreva o problema urbano do seu bairro — buraco, iluminação, coleta de lixo e outros — com fotos, se quiser.",
  },
  {
    titulo: "2. Moderação por IA",
    descricao:
      "Cada reclamação passa por checagens automáticas de conteúdo antes de ir ao ar publicamente.",
  },
  {
    titulo: "3. Órgão responde",
    descricao:
      "O órgão responsável responde oficialmente e atualiza o status do problema.",
  },
  {
    titulo: "4. Você confirma",
    descricao:
      "Avalie se o problema foi realmente resolvido — sua nota entra no índice público da cidade.",
  },
];

const DIFERENCIAIS = [
  {
    icone: BrainCircuit,
    titulo: "Moderação por IA",
    descricao:
      "Texto e imagem passam por checagens automáticas — conteúdo ofensivo, spam, dados pessoais, repostagem — antes de qualquer publicação.",
  },
  {
    icone: Award,
    titulo: "Reputação pública de órgãos",
    descricao:
      "Cada órgão tem um selo público (Ótimo, Bom, Regular, Ruim), calculado a partir do tempo de resposta e da taxa real de resolução.",
  },
  {
    icone: MessageSquare,
    titulo: "Comunidade ativa",
    descricao:
      "Confirme problemas que também afetam você e comente em qualquer reclamação — com moderação e fila de revisão humana.",
  },
  {
    icone: ShieldCheck,
    titulo: "Conta protegida",
    descricao:
      "Autenticação em duas etapas por aplicativo autenticador, CPF único por conta e verificação de e-mail.",
  },
];

export default async function Home() {
  const [
    totalReclamacoes,
    totalResolvidas,
    totalCidades,
    totalOrgaos,
    reclamacoesRecentes,
    candidatosResposta,
  ] = await Promise.all([
    prisma.reclamacao.count({ where: { status: { in: [...STATUS_PUBLICOS] } } }),
    prisma.reclamacao.count({ where: { status: "RESOLVIDA" } }),
    prisma.cidade.count({
      where: { reclamacoes: { some: { status: { in: [...STATUS_PUBLICOS] } } } },
    }),
    prisma.orgao.count({ where: { ativo: true } }),
    prisma.reclamacao.findMany({
      where: { status: { in: [...STATUS_PUBLICOS] } },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: {
        categoria: true,
        cidade: { include: { estado: true } },
        _count: { select: { confirmacoes: true } },
      },
    }),
    prisma.respostaOficial.groupBy({
      by: ["orgaoId"],
      _count: { orgaoId: true },
      orderBy: { _count: { orgaoId: "desc" } },
      take: 6,
    }),
  ]);

  const orgaosCandidatos = await prisma.orgao.findMany({
    where: { id: { in: candidatosResposta.map((c) => c.orgaoId) }, ativo: true },
    include: { cidade: true },
  });

  const rankingOrgaos = (
    await Promise.all(
      orgaosCandidatos.map(async (orgao) => ({
        orgao,
        metricas: await calcularMetricasOrgao(orgao.id),
      }))
    )
  )
    .filter(({ metricas }) => metricas.indiceResolucao !== null)
    .sort((a, b) => (b.metricas.indiceResolucao ?? 0) - (a.metricas.indiceResolucao ?? 0))
    .slice(0, 3);

  const indiceResolucao =
    totalReclamacoes > 0 ? Math.round((totalResolvidas / totalReclamacoes) * 100) : null;

  const ESTATISTICAS = [
    { valor: totalReclamacoes, rotulo: "reclamações registradas" },
    { valor: totalCidades, rotulo: "cidades atendidas" },
    { valor: totalOrgaos, rotulo: "órgãos participantes" },
    {
      valor: indiceResolucao !== null ? `${indiceResolucao}%` : "—",
      rotulo: "índice de resolução",
    },
  ];

  return (
    <main className="flex flex-1 flex-col items-center overflow-hidden">
      <section className="relative flex w-full flex-col items-center gap-10 border-b border-slate-200 px-6 py-20 sm:px-8 sm:py-28 dark:border-slate-800">
        <div
          aria-hidden
          className="bg-city-grid animate-city-grid-drift pointer-events-none absolute inset-0 -z-10"
        />

        <div className="animate-fade-in flex max-w-2xl flex-col items-center gap-5 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent-dark dark:text-accent">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Moderação de conteúdo assistida por IA
          </span>

          <h1 className="text-5xl font-semibold tracking-tight text-slate-900 sm:text-6xl dark:text-slate-100">
            Urban <span className="text-primary">Grid</span>
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Registre problemas urbanos do seu município, acompanhe a resposta
            oficial do órgão responsável e confirme quando o problema for
            resolvido de verdade.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Link href="/reclamacoes" className={`${botaoPrimario} group px-6 py-3 text-base`}>
              Ver reclamações públicas
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-1"
                aria-hidden
              />
            </Link>
            <Link href="/cadastro" className={`${botaoSecundario} px-6 py-3 text-base`}>
              Criar conta
            </Link>
          </div>
          <Link href="/login" className="text-sm text-primary underline">
            Já tem conta? Entrar
          </Link>
        </div>

        {totalReclamacoes > 0 && (
          <div className="grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
            {ESTATISTICAS.map((item, indice) => (
              <div
                key={item.rotulo}
                style={{ animationDelay: `${indice * 80}ms` }}
                className="animate-fade-in flex flex-col items-center gap-1 rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <span className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  {item.valor}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{item.rotulo}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex w-full flex-col items-center gap-8 px-6 py-16 sm:px-8">
        <Revelar className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Como funciona
          </h2>
          <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
            Do registro à confirmação, cada etapa é pública e auditável.
          </p>
        </Revelar>

        <Revelar atraso={120} className="grid w-full max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PASSOS.map((passo, indice) => (
            <div
              key={passo.titulo}
              style={{ animationDelay: `${indice * 80}ms` }}
              className="animate-fade-in flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
            >
              <p className="font-semibold text-slate-900 dark:text-slate-100">{passo.titulo}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">{passo.descricao}</p>
            </div>
          ))}
        </Revelar>
      </section>

      {reclamacoesRecentes.length > 0 && (
        <section className="flex w-full flex-col items-center gap-8 border-t border-slate-200 bg-slate-50 px-6 py-16 sm:px-8 dark:border-slate-800 dark:bg-slate-950/50">
          <Revelar className="flex flex-col items-center gap-2 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Acontecendo agora
            </h2>
            <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
              As reclamações mais recentes registradas na plataforma, em
              tempo real.
            </p>
          </Revelar>

          <Revelar atraso={120} className="grid w-full max-w-4xl gap-4 sm:grid-cols-3">
            {reclamacoesRecentes.map((reclamacao, indice) => (
              <Link
                key={reclamacao.id}
                href={`/reclamacoes/${reclamacao.protocolo}`}
                style={{ animationDelay: `${indice * 80}ms` }}
                className={`animate-fade-in flex flex-col gap-2 transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md ${cartao}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                    <CategoriaIcon
                      icone={reclamacao.categoria.icone}
                      className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500"
                    />
                    {reclamacao.categoria.nome}
                  </span>
                  <StatusBadge status={reclamacao.status} />
                </div>
                <p className="line-clamp-2 font-semibold text-slate-900 dark:text-slate-100">
                  {reclamacao.titulo}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {reclamacao.cidade.nome} - {reclamacao.cidade.estado.uf} ·{" "}
                  {reclamacao._count.confirmacoes} confirmação(ões)
                </p>
              </Link>
            ))}
          </Revelar>

          <Link
            href="/reclamacoes"
            className="flex items-center gap-1 text-sm font-medium text-primary underline"
          >
            Ver todas as reclamações
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </section>
      )}

      <section className="flex w-full flex-col items-center gap-8 border-t border-slate-200 px-6 py-16 sm:px-8 dark:border-slate-800">
        <Revelar className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Por que o Urban Grid é diferente
          </h2>
          <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
            Um canal direto entre cidadão e órgão público, com transparência
            em cada etapa.
          </p>
        </Revelar>

        <Revelar atraso={120} className="grid w-full max-w-4xl gap-4 sm:grid-cols-2">
          {DIFERENCIAIS.map((item, indice) => (
            <div
              key={item.titulo}
              style={{ animationDelay: `${indice * 80}ms` }}
              className="animate-fade-in group flex gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-transform group-hover:scale-110 dark:bg-blue-500/10">
                <item.icone className="h-5 w-5 text-primary" aria-hidden />
              </div>
              <div className="flex flex-col gap-1">
                <p className="font-semibold text-slate-900 dark:text-slate-100">{item.titulo}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">{item.descricao}</p>
              </div>
            </div>
          ))}
        </Revelar>
      </section>

      {rankingOrgaos.length > 0 && (
        <section className="flex w-full flex-col items-center gap-8 border-t border-slate-200 bg-slate-50 px-6 py-16 sm:px-8 dark:border-slate-800 dark:bg-slate-950/50">
          <Revelar className="flex flex-col items-center gap-2 text-center">
            <span className="inline-flex items-center gap-1.5 text-primary dark:text-blue-400">
              <TrendingUp className="h-5 w-5" aria-hidden />
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Órgãos mais bem avaliados
            </h2>
            <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
              Selo público calculado a partir do tempo de resposta e da taxa
              real de resolução — sem autoavaliação.
            </p>
          </Revelar>

          <Revelar atraso={120} className="grid w-full max-w-3xl gap-4 sm:grid-cols-3">
            {rankingOrgaos.map(({ orgao, metricas }, indice) => {
              const classificacao = classificarIndice(
                metricas.indiceResolucao,
                metricas.totalRespondidas
              );
              return (
                <Link
                  key={orgao.id}
                  href={`/orgaos/${orgao.id}`}
                  style={{ animationDelay: `${indice * 80}ms` }}
                  className={`animate-fade-in flex flex-col gap-2 transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md ${cartao}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-block shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${classificacao.className}`}
                    >
                      {classificacao.label}
                    </span>
                    <span className="text-xs font-semibold text-slate-400 dark:text-slate-600">
                      #{indice + 1}
                    </span>
                  </div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {orgao.nome}
                    {orgao.sigla && ` (${orgao.sigla})`}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {orgao.cidade.nome} · {metricas.totalRespondidas} reclamação(ões)
                    respondida(s)
                  </p>
                </Link>
              );
            })}
          </Revelar>
        </section>
      )}

      <section className="flex w-full flex-col items-center gap-4 border-t border-slate-200 px-6 py-16 text-center sm:px-8 dark:border-slate-800">
        <Revelar className="flex flex-col items-center gap-4">
          <MapPin className="h-8 w-8 text-primary" aria-hidden />
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Pronto para participar?
          </h2>
          <p className="max-w-md text-sm text-slate-600 dark:text-slate-400">
            Cidadãos registram problemas do seu bairro. Órgãos públicos
            respondem oficialmente e constroem sua reputação.
          </p>

          <div className="mt-4 grid w-full max-w-3xl gap-4 sm:grid-cols-2">
            <div className={`group flex flex-col items-center gap-3 text-center ${cartao}`}>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 transition-transform group-hover:scale-110 dark:bg-blue-500/10">
                <IdCard className="h-5 w-5 text-primary" aria-hidden />
              </div>
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                Sou cidadão
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Registre a primeira reclamação da sua cidade — o feed público
                e o índice de resolução são criados automaticamente.
              </p>
              <Link href="/cadastro" className={`${botaoPrimario} mt-1`}>
                Criar conta gratuita
              </Link>
            </div>

            <div className={`group flex flex-col items-center gap-3 text-center ${cartao}`}>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 transition-transform group-hover:scale-110 dark:bg-blue-500/10">
                <Landmark className="h-5 w-5 text-primary" aria-hidden />
              </div>
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                Sou órgão público
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Solicite acesso para responder oficialmente às reclamações da
                sua cidade. Um administrador analisa cada pedido.
              </p>
              <Link href="/cadastro?tipo=orgao" className={`${botaoSecundario} mt-1`}>
                Solicitar acesso
              </Link>
            </div>
          </div>
        </Revelar>
      </section>
    </main>
  );
}
