import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { Paginacao } from "@/components/paginacao";
import { calcularSkip, calcularTotalPaginas, ITENS_POR_PAGINA, lerPaginaAtual } from "@/lib/paginacao";
import { botaoPrimario, botaoSecundario, campoInput, cartao, containerPagina } from "@/lib/estilos";

import { aprovarReclamacao, rejeitarReclamacao } from "./actions";
import { exigirModerador } from "./exigir-moderador";

export default async function ModeracaoPage({ searchParams }: PageProps<"/moderacao">) {
  await exigirModerador();

  const { page } = await searchParams;
  const paginaAtual = lerPaginaAtual(page);
  const filtro = { status: "AGUARDANDO_REVISAO" as const };

  const [pendentes, totalPendentes] = await Promise.all([
    prisma.reclamacao.findMany({
      where: filtro,
      orderBy: { updatedAt: "asc" },
      include: {
        categoria: true,
        cidade: { include: { estado: true } },
        autor: true,
        midias: { orderBy: { ordem: "asc" } },
      },
      skip: calcularSkip(paginaAtual),
      take: ITENS_POR_PAGINA,
    }),
    prisma.reclamacao.count({ where: filtro }),
  ]);
  const totalPaginas = calcularTotalPaginas(totalPendentes);

  const logs = pendentes.length
    ? await prisma.logModeracao.findMany({
        where: {
          alvoTipo: "RECLAMACAO",
          alvoId: { in: pendentes.map((reclamacao) => reclamacao.id) },
          decisao: "ENCAMINHAR_REVISAO",
          revisadoEm: null,
        },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const logPorReclamacao = new Map(logs.map((log) => [log.alvoId, log]));

  return (
    <main className={`${containerPagina} max-w-3xl`}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Fila de moderação
        </h1>
        <Link href="/moderacao/historico" className="text-sm text-primary underline">
          Ver histórico completo
        </Link>
      </div>

      {pendentes.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Nenhuma reclamação aguardando revisão.
        </p>
      )}

      {pendentes.map((reclamacao) => {
        const log = logPorReclamacao.get(reclamacao.id);
        const blurPendente = reclamacao.midias.some(
          (midia) => midia.statusModeracao === "REVISAO_HUMANA" && !midia.urlTratada
        );

        return (
          <div key={reclamacao.id} className={`flex flex-col gap-2 ${cartao}`}>
            <p className="font-medium text-slate-900 dark:text-slate-100">{reclamacao.titulo}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {reclamacao.protocolo} · {reclamacao.categoria.nome} ·{" "}
              {reclamacao.cidade.nome} - {reclamacao.cidade.estado.uf} ·{" "}
              {reclamacao.endereco}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Autor: {reclamacao.autor.name ?? reclamacao.autor.email}
            </p>
            <p className="text-slate-800 dark:text-slate-200">{reclamacao.descricao}</p>

            {reclamacao.emRecurso && (
              <div className="rounded-lg bg-blue-50 p-3 text-sm dark:bg-blue-950/40">
                <p className="font-medium text-blue-800 dark:text-blue-300">
                  Recurso do cidadão contra rejeição
                </p>
                {reclamacao.motivoRejeicao && (
                  <p className="text-blue-900 dark:text-blue-200">
                    Motivo original da rejeição: {reclamacao.motivoRejeicao}
                  </p>
                )}
                {reclamacao.textoRecurso && (
                  <p className="mt-1 italic text-blue-900 dark:text-blue-200">
                    Argumento do autor: “{reclamacao.textoRecurso}”
                  </p>
                )}
              </div>
            )}

            {reclamacao.midias.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {reclamacao.midias.map((midia) => (
                  // eslint-disable-next-line @next/next/no-img-element -- imagem externa (Vercel Blob), sem domínio fixo pra configurar no next/image
                  <img
                    key={midia.id}
                    src={midia.urlTratada ?? midia.url}
                    alt=""
                    className="h-32 w-32 rounded-lg border border-slate-200 object-cover dark:border-slate-700"
                  />
                ))}
              </div>
            )}

            {log && (
              <div className="rounded-lg bg-amber-50 p-3 text-sm dark:bg-amber-950/40">
                <p className="font-medium text-amber-800 dark:text-amber-300">Análise da IA</p>
                <p className="text-amber-900 dark:text-amber-200">
                  Ofensivo: {log.scoreOfensivo?.toFixed(2)}
                </p>
                <p className="text-amber-900 dark:text-amber-200">
                  Spam: {log.scoreSpam?.toFixed(2)}
                </p>
                <p className="text-amber-900 dark:text-amber-200">
                  Dados pessoais: {log.scoreDadosPessoais?.toFixed(2)}
                </p>
                <p className="text-amber-900 dark:text-amber-200">
                  Fora de escopo: {log.scoreForaEscopo?.toFixed(2)}
                </p>
                <p className="text-amber-900 dark:text-amber-200">
                  Desinformação: {log.scoreDesinformacao?.toFixed(2)}
                </p>
                {log.coerenciaTextoImagem !== null && (
                  <p className="text-amber-900 dark:text-amber-200">
                    Coerência texto/imagem: {log.coerenciaTextoImagem?.toFixed(2)}
                  </p>
                )}
                {log.justificativa && (
                  <p className="mt-1 italic text-amber-900 dark:text-amber-200">
                    {log.justificativa}
                  </p>
                )}
              </div>
            )}

            {blurPendente && (
              <p className="text-sm text-red-700 dark:text-red-400">
                O desfoque automático falhou em pelo menos uma foto desta
                reclamação (rosto ou placa detectados). Aprovar está
                bloqueado até isso ser resolvido — rejeite se não puder
                corrigir a imagem.
              </p>
            )}

            <div className="flex items-start gap-2">
              <form action={aprovarReclamacao.bind(null, reclamacao.id)}>
                <button
                  type="submit"
                  disabled={blurPendente}
                  title={blurPendente ? "Desfoque pendente nesta reclamação" : undefined}
                  className={botaoPrimario}
                >
                  Aprovar
                </button>
              </form>

              <form
                action={rejeitarReclamacao.bind(null, reclamacao.id)}
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
        );
      })}

      <Paginacao paginaAtual={paginaAtual} totalPaginas={totalPaginas} basePath="/moderacao" />
    </main>
  );
}
