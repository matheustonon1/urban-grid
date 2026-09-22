import { prisma } from "@/lib/prisma";
import { cartao, containerPagina } from "@/lib/estilos";

import { exigirModerador } from "../exigir-moderador";

const DIAS_VOLUME = 14;

const DECISAO_LABEL: Record<string, string> = {
  APROVAR: "Aprovado",
  REPROVAR: "Reprovado",
  ENCAMINHAR_REVISAO: "Revisão humana",
};

const DECISAO_COR: Record<string, string> = {
  APROVAR: "text-green-700 dark:text-green-400",
  REPROVAR: "text-red-700 dark:text-red-400",
  ENCAMINHAR_REVISAO: "text-amber-700 dark:text-amber-400",
};

function Estatistica({ label, valor }: { label: string; valor: string }) {
  return (
    <div className={`flex flex-col gap-1 ${cartao}`}>
      <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">{valor}</span>
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
    </div>
  );
}

function BarraScore({ rotulo, valor }: { rotulo: string; valor: number | null }) {
  const pct = valor !== null ? Math.round(valor * 100) : null;
  return (
    <div className="flex items-center gap-3">
      <span className="w-40 shrink-0 text-sm text-slate-600 dark:text-slate-400">{rotulo}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct ?? 0}%` }}
        />
      </div>
      <span className="w-12 shrink-0 text-right text-sm font-medium text-slate-700 dark:text-slate-300">
        {pct !== null ? `${pct}%` : "—"}
      </span>
    </div>
  );
}

function formatarDiaChave(data: Date) {
  return data.toISOString().slice(0, 10);
}

function formatarDiaCurto(chave: string) {
  const [, mes, dia] = chave.split("-");
  return `${dia}/${mes}`;
}

export default async function EstatisticasModeracaoPage() {
  await exigirModerador();

  const agora = new Date();
  const desde = new Date(agora.getTime() - DIAS_VOLUME * 86_400_000);
  desde.setHours(0, 0, 0, 0);

  const [
    porTipoEDecisao,
    agregadoReclamacao,
    agregadoComentario,
    revisadosHumano,
    logsRecentes,
  ] = await Promise.all([
    prisma.logModeracao.groupBy({
      by: ["alvoTipo", "decisao"],
      _count: { _all: true },
    }),
    prisma.logModeracao.aggregate({
      where: { alvoTipo: "RECLAMACAO" },
      _avg: {
        latenciaMs: true,
        scoreOfensivo: true,
        scoreSpam: true,
        scoreDadosPessoais: true,
        scoreForaEscopo: true,
        scoreDesinformacao: true,
        coerenciaTextoImagem: true,
      },
      _count: { _all: true },
    }),
    prisma.logModeracao.aggregate({
      where: { alvoTipo: "COMENTARIO" },
      _avg: { latenciaMs: true, scoreOfensivo: true, scoreSpam: true, scoreDadosPessoais: true },
      _count: { _all: true },
    }),
    prisma.logModeracao.findMany({
      where: { decisaoFinal: { not: null } },
      select: { decisao: true, decisaoFinal: true },
    }),
    prisma.logModeracao.findMany({
      where: { createdAt: { gte: desde } },
      select: { createdAt: true },
    }),
  ]);

  const totalAnalises = porTipoEDecisao.reduce((soma, item) => soma + item._count._all, 0);
  const totalAprovado = porTipoEDecisao
    .filter((item) => item.decisao === "APROVAR")
    .reduce((soma, item) => soma + item._count._all, 0);
  const taxaAprovacao = totalAnalises > 0 ? Math.round((totalAprovado / totalAnalises) * 100) : null;

  const totalRevisados = revisadosHumano.length;
  const totalConcordou = revisadosHumano.filter((log) => log.decisaoFinal === log.decisao).length;
  const concordanciaHumana =
    totalRevisados > 0 ? Math.round((totalConcordou / totalRevisados) * 100) : null;

  const latenciaMediaMs = agregadoReclamacao._avg.latenciaMs ?? agregadoComentario._avg.latenciaMs;

  const diasChaves: string[] = [];
  for (let i = DIAS_VOLUME - 1; i >= 0; i--) {
    diasChaves.push(formatarDiaChave(new Date(agora.getTime() - i * 86_400_000)));
  }
  const contagemPorDia = new Map(diasChaves.map((chave) => [chave, 0]));
  for (const log of logsRecentes) {
    const chave = formatarDiaChave(log.createdAt);
    contagemPorDia.set(chave, (contagemPorDia.get(chave) ?? 0) + 1);
  }
  const volumeDiario = diasChaves.map((chave) => ({
    chave,
    total: contagemPorDia.get(chave) ?? 0,
  }));
  const maximoVolume = Math.max(...volumeDiario.map((d) => d.total), 1);

  const linhasPorTipo = (["RECLAMACAO", "COMENTARIO"] as const).map((tipo) => ({
    tipo,
    decisoes: porTipoEDecisao.filter((item) => item.alvoTipo === tipo),
  }));

  return (
    <main className={`${containerPagina} max-w-3xl`}>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        Estatísticas de moderação
      </h1>

      {totalAnalises === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Nenhuma análise de moderação registrada ainda.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Estatistica label="Análises no total" valor={String(totalAnalises)} />
            <Estatistica
              label="Taxa de aprovação"
              valor={taxaAprovacao !== null ? `${taxaAprovacao}%` : "—"}
            />
            <Estatistica
              label="Tempo médio de resposta"
              valor={latenciaMediaMs != null ? `${(latenciaMediaMs / 1000).toFixed(1)}s` : "—"}
            />
            <Estatistica
              label="Concordância humana"
              valor={
                concordanciaHumana !== null
                  ? `${concordanciaHumana}%`
                  : "sem revisão ainda"
              }
            />
          </div>

          <div className={`flex flex-col gap-3 ${cartao}`}>
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">Decisões por tipo</h2>
            {linhasPorTipo.map(({ tipo, decisoes }) => {
              const total = decisoes.reduce((soma, item) => soma + item._count._all, 0);
              if (total === 0) return null;
              return (
                <div key={tipo} className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {tipo === "RECLAMACAO" ? "Reclamações" : "Comentários"} ({total})
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {decisoes.map((item) => (
                      <span key={item.decisao} className={DECISAO_COR[item.decisao]}>
                        {DECISAO_LABEL[item.decisao]}: {item._count._all} (
                        {Math.round((item._count._all / total) * 100)}%)
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {agregadoReclamacao._count._all > 0 && (
            <div className={`flex flex-col gap-3 ${cartao}`}>
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                Score médio — reclamações
              </h2>
              <BarraScore rotulo="Ofensivo" valor={agregadoReclamacao._avg.scoreOfensivo} />
              <BarraScore rotulo="Spam" valor={agregadoReclamacao._avg.scoreSpam} />
              <BarraScore rotulo="Dados pessoais" valor={agregadoReclamacao._avg.scoreDadosPessoais} />
              <BarraScore rotulo="Fora de escopo" valor={agregadoReclamacao._avg.scoreForaEscopo} />
              <BarraScore rotulo="Desinformação" valor={agregadoReclamacao._avg.scoreDesinformacao} />
              <BarraScore
                rotulo="Coerência texto/imagem"
                valor={agregadoReclamacao._avg.coerenciaTextoImagem}
              />
            </div>
          )}

          {agregadoComentario._count._all > 0 && (
            <div className={`flex flex-col gap-3 ${cartao}`}>
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                Score médio — comentários
              </h2>
              <BarraScore rotulo="Ofensivo" valor={agregadoComentario._avg.scoreOfensivo} />
              <BarraScore rotulo="Spam" valor={agregadoComentario._avg.scoreSpam} />
              <BarraScore rotulo="Dados pessoais" valor={agregadoComentario._avg.scoreDadosPessoais} />
            </div>
          )}

          <div className={`flex flex-col gap-3 ${cartao}`}>
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">
              Volume nos últimos {DIAS_VOLUME} dias
            </h2>
            <div className="flex h-32 items-end gap-1">
              {volumeDiario.map((dia) => (
                <div
                  key={dia.chave}
                  title={`${formatarDiaCurto(dia.chave)}: ${dia.total} análise(s)`}
                  className="flex-1 rounded-t bg-primary/70 transition-colors hover:bg-primary"
                  style={{
                    height: `${dia.total > 0 ? Math.max((dia.total / maximoVolume) * 100, 4) : 1}%`,
                  }}
                />
              ))}
            </div>
            <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500">
              <span>{formatarDiaCurto(volumeDiario[0].chave)}</span>
              <span>{formatarDiaCurto(volumeDiario[volumeDiario.length - 1].chave)}</span>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
