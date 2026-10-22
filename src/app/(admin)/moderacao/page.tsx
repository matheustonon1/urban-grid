import Link from "next/link";
import { CircleCheck, History, MapPin } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { Aviso } from "@/components/ui/aviso";
import { AvatarIniciais } from "@/components/ui/avatar-iniciais";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Etiqueta, type TomEtiqueta } from "@/components/ui/etiqueta";
import { FormularioRejeicao } from "@/components/ui/formulario-rejeicao";
import { Paginacao } from "@/components/ui/paginacao";
import { ResumoLateral } from "@/components/ui/resumo-lateral";
import { Secao } from "@/components/ui/secao";
import { GuiaPontuacoes } from "@/components/moderacao/guia-pontuacoes";
import { PontuacoesIA } from "@/components/moderacao/pontuacoes-ia";
import { TempoNaFila } from "@/components/moderacao/tempo-na-fila";
import { calcularSkip, calcularTotalPaginas, ITENS_POR_PAGINA, lerPaginaAtual } from "@/lib/util/paginacao";
import {
  blocoCitacao,
  botaoPrimario,
  botaoSecundario,
  cartaoSecao,
  colunaLateral,
  colunaPrincipal,
  grade,
  pagina,
  painelSuave,
  rotuloSecao,
} from "@/lib/estilos";
import { metadataDaPagina } from "@/lib/metadata";

import { aprovarReclamacao, rejeitarReclamacao } from "./actions";
import { exigirModerador } from "./exigir-moderador";

export const generateMetadata = metadataDaPagina("Moderacao");

type Origem = "ia" | "recurso" | "falha";

const TOM_ORIGEM: Record<Origem, TomEtiqueta> = {
  ia: "atencao",
  recurso: "info",
  falha: "neutro",
};

// As mensagens dos eixos trazem ":" no fim (herança do formato em texto
// corrido); na barra o rótulo fica sem ele.
const rotuloEixo = (rotulo: string) => rotulo.replace(/:\s*$/, "");

export default async function ModeracaoPage({ searchParams }: PageProps<"/moderacao">) {
  const t = await getTranslations("Moderacao");
  const tNav = await getTranslations("AdminNav");
  await exigirModerador();

  const { page } = await searchParams;
  const paginaAtual = lerPaginaAtual(page);
  const filtro = { status: "AGUARDANDO_REVISAO" as const };

  const [pendentes, totalPendentes, totalRecursos] = await Promise.all([
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
    prisma.reclamacao.count({ where: { ...filtro, emRecurso: true } }),
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
    <main className={pagina}>
      <CabecalhoPagina
        kicker={tNav("kickerModeracao")}
        titulo={t("titulo")}
        descricao={t("resumoPendentes", { count: totalPendentes })}
        acoes={
          <Link href="/moderacao/historico" className={botaoSecundario}>
            <History className="h-4 w-4" aria-hidden />
            {t("verHistorico")}
          </Link>
        }
      />

      <div className={grade}>
        <div className={colunaPrincipal}>
          <Secao id="fila" titulo={t("resumoRotulo")}>
            {pendentes.length === 0 && (
              <EstadoVazio
                icone={CircleCheck}
                titulo={t("nenhumaPendente")}
                descricao={t("nenhumaPendenteDesc")}
              />
            )}

            {pendentes.map((reclamacao) => {
              const log = logPorReclamacao.get(reclamacao.id);
              const blurPendente = reclamacao.midias.some(
                (midia) => midia.statusModeracao === "REVISAO_HUMANA" && !midia.urlTratada
              );
              // Por que esta reclamação está na fila: contestação do autor, análise
              // da IA que pediu olho humano, ou (sem nenhum dos dois) falha no
              // processamento automático - o moderador precisa saber qual é o caso.
              const origem: Origem = reclamacao.emRecurso ? "recurso" : log ? "ia" : "falha";
              const nomeAutor = reclamacao.autor.name ?? reclamacao.autor.email;

              return (
                <article key={reclamacao.id} className={`flex flex-col gap-5 ${cartaoSecao}`}>
                  <header className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Etiqueta tom={TOM_ORIGEM[origem]}>{t(`origem_${origem}`)}</Etiqueta>
                      <TempoNaFila desde={reclamacao.updatedAt} />
                    </div>
                    <p className="kicker">
                      {reclamacao.protocolo} · {reclamacao.categoria.nome}
                    </p>
                    <h3 className="text-xl leading-snug font-extrabold tracking-tight text-ink">
                      {reclamacao.titulo}
                    </h3>
                    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-ink-muted">
                      <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {reclamacao.endereco} - {reclamacao.cidade.nome}/{reclamacao.cidade.estado.uf}
                    </p>
                  </header>

                  <div className="flex items-center gap-2 text-sm text-ink-muted">
                    <AvatarIniciais nome={nomeAutor} />
                    <span>
                      {t("autor")} <span className="font-medium text-ink-2">{nomeAutor}</span>
                    </span>
                  </div>

                  <p className={blocoCitacao}>{reclamacao.descricao}</p>

                  {reclamacao.midias.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {reclamacao.midias.map((midia) => (
                        // eslint-disable-next-line @next/next/no-img-element -- imagem externa (Vercel Blob), sem domínio fixo pra configurar no next/image
                        <img
                          key={midia.id}
                          src={midia.urlTratada ?? midia.url}
                          alt=""
                          className="aspect-square w-full rounded-md border border-line object-cover"
                        />
                      ))}
                    </div>
                  )}

                  {reclamacao.emRecurso && (
                    <Aviso tom="info">
                      <p className="font-semibold">{t("recursoContraRejeicao")}</p>
                      {reclamacao.motivoRejeicao && (
                        <p>
                          {t("motivoOriginalRejeicao")} {reclamacao.motivoRejeicao}
                        </p>
                      )}
                      {reclamacao.textoRecurso && (
                        <p className="mt-1 italic">
                          {t("argumentoAutor")} “{reclamacao.textoRecurso}”
                        </p>
                      )}
                    </Aviso>
                  )}

                  {log && (
                    <div className={`flex flex-col gap-3 ${painelSuave}`}>
                      <p className={rotuloSecao}>{t("analiseIA")}</p>
                      <PontuacoesIA
                        itens={[
                          { rotulo: t("geral"), valor: log.scoreGeral, destaque: true },
                          { rotulo: rotuloEixo(t("ofensivo")), valor: log.scoreOfensivo },
                          { rotulo: rotuloEixo(t("spam")), valor: log.scoreSpam },
                          { rotulo: rotuloEixo(t("dadosPessoais")), valor: log.scoreDadosPessoais },
                          { rotulo: rotuloEixo(t("foraDeEscopo")), valor: log.scoreForaEscopo },
                          { rotulo: rotuloEixo(t("desinformacao")), valor: log.scoreDesinformacao },
                          {
                            rotulo: rotuloEixo(t("coerenciaTextoImagem")),
                            valor: log.coerenciaTextoImagem,
                            invertido: true,
                          },
                        ]}
                      />
                      {log.justificativa && (
                        <p className="text-sm text-ink-2 italic">“{log.justificativa}”</p>
                      )}
                    </div>
                  )}

                  {origem === "falha" && <Aviso tom="atencao">{t("semAnaliseIA")}</Aviso>}

                  {blurPendente && <Aviso tom="erro">{t("desfoquePendenteDesc")}</Aviso>}

                  <div className="grid gap-4 border-t border-line pt-5 sm:grid-cols-[auto_1fr] sm:items-end">
                    <form action={aprovarReclamacao.bind(null, reclamacao.id)}>
                      <button
                        type="submit"
                        disabled={blurPendente}
                        title={blurPendente ? t("desfoquePendenteTitulo") : undefined}
                        className={`${botaoPrimario} w-full sm:w-auto`}
                      >
                        {t("aprovar")}
                      </button>
                    </form>

                    <FormularioRejeicao
                      id={`motivo-${reclamacao.id}`}
                      action={rejeitarReclamacao.bind(null, reclamacao.id)}
                      rotulo={t("motivoRejeicaoPlaceholder")}
                      botao={t("rejeitar")}
                    />
                  </div>
                </article>
              );
            })}

            <Paginacao paginaAtual={paginaAtual} totalPaginas={totalPaginas} basePath="/moderacao" />
          </Secao>
        </div>

        <aside className={colunaLateral}>
          <ResumoLateral
            rotulo={t("resumoRotulo")}
            valor={totalPendentes}
            itens={[
              { rotulo: t("resumoRecursos"), valor: totalRecursos },
              { rotulo: t("resumoOutras"), valor: totalPendentes - totalRecursos },
            ]}
          />
          <GuiaPontuacoes />
        </aside>
      </div>
    </main>
  );
}
