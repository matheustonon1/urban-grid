import { BarChart3 } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { Aviso } from "@/components/aviso";
import { BarraDecisoes } from "@/components/barra-decisoes";
import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { EstadoVazio } from "@/components/estado-vazio";
import {
  carregarEstatisticasModeracao,
  LIMITE_LINHAS_ESTATISTICAS,
} from "@/lib/carregarEstatisticasModeracao";
import {
  consumoDoModelo,
  disparosPorEixo,
  ehFalhaDaIA,
  escolherGranularidade,
  histogramaScore,
  idadesDaFila,
  interpretarPeriodo,
  LIMITE_REVISAO,
  motivosDeRevisao,
  percentil,
  porVersaoDoPrompt,
  resumirDecisoes,
  resumirDenuncias,
  revisaoHumana,
  variacaoPontos,
  variacaoRelativa,
  volumePorPeriodo,
} from "@/lib/estatisticasModeracao";
import { containerLargo } from "@/lib/estilos";
import { formatarNumero, formatarPorcentagem, formatarVariacao } from "@/lib/formatarEstatistica";
import { metadataDaPagina } from "@/lib/metadata";
import { LIMITE_REPROVACAO_COMENTARIO } from "@/lib/pontuacoes";

import { exigirModerador } from "../exigir-moderador";
import { DenunciasDoPeriodo } from "./denuncias";
import { EixosQueDisparam } from "./eixos";
import { FilaAgora } from "./fila-agora";
import { GraficoVolume } from "./grafico-volume";
import { HistogramaPontuacoes } from "./histograma";
import { IaVersusHumano } from "./ia-humano";
import { Kpis, type Variacao } from "./kpis";
import { SecaoEstatistica } from "./partes";
import { SeletorPeriodo } from "./seletor-periodo";
import { ConsumoDoModelo, VersoesDoPrompt } from "./versoes-consumo";

export const generateMetadata = metadataDaPagina("Estatisticas");

const MS_DIA = 86_400_000;

// Diferença menor que isto (em % ou pp) é ruído de arredondamento: mostra "="
// em vez de uma seta pra cima ou pra baixo que não quer dizer nada.
const LIMIAR_IGUAL = 0.05;

function comoVariacao(valor: number | null, unidade: "%" | "pp", locale: string): Variacao | null {
  if (valor === null) return null;
  return {
    texto: formatarVariacao(valor, locale, unidade),
    direcao: Math.abs(valor) < LIMIAR_IGUAL ? "igual" : valor > 0 ? "sobe" : "desce",
  };
}

export default async function EstatisticasModeracaoPage({
  searchParams,
}: PageProps<"/moderacao/estatisticas">) {
  const t = await getTranslations("Estatisticas");
  const locale = await getLocale();
  await exigirModerador();

  const { dias } = await searchParams;
  const periodo = interpretarPeriodo(dias);
  const dados = await carregarEstatisticasModeracao(periodo);
  const { logs, logsAnteriores, agora } = dados;

  const filas = [
    { chave: "reclamacoes" as const, href: "/moderacao", idades: idadesDaFila(dados.filas.reclamacoes, agora) },
    { chave: "comentarios" as const, href: "/moderacao/comentarios", idades: idadesDaFila(dados.filas.comentarios, agora) },
    { chave: "denuncias" as const, href: "/denuncias", idades: idadesDaFila(dados.filas.denuncias, agora) },
  ];

  const cabecalho = (
    <CabecalhoPagina
      titulo={t("titulo")}
      descricao={t("subtitulo")}
      acoes={<SeletorPeriodo atual={periodo.chave} />}
    />
  );

  if (logs.length === 0) {
    return (
      <main className={containerLargo}>
        {cabecalho}
        <EstadoVazio
          icone={BarChart3}
          titulo={periodo.dias ? t("nenhumaAnalisePeriodo") : t("nenhumaAnalise")}
          descricao={periodo.dias ? t("tenteOutroPeriodo") : undefined}
        />
        <FilaAgora filas={filas} />
      </main>
    );
  }

  const resumo = resumirDecisoes(logs);
  const anterior = logsAnteriores ? resumirDecisoes(logsAnteriores) : null;
  const comparar = anterior !== null && anterior.total > 0;

  const kpis = [
    {
      rotulo: t("kpiAnalises"),
      valor: formatarNumero(resumo.total, locale),
      variacao: comparar ? comoVariacao(variacaoRelativa(resumo.total, anterior.total), "%", locale) : null,
      detalhe: resumo.falhas > 0 ? t("kpiFalhas", { count: resumo.falhas }) : undefined,
    },
    {
      rotulo: t("kpiAprovadas"),
      valor: formatarPorcentagem(resumo.taxaAprovar, locale),
      variacao: comparar ? comoVariacao(variacaoPontos(resumo.taxaAprovar, anterior.taxaAprovar), "pp", locale) : null,
      detalhe: t("kpiDe", { n: resumo.aprovar, total: resumo.validas }),
    },
    {
      rotulo: t("kpiRevisao"),
      valor: formatarPorcentagem(resumo.taxaEncaminhar, locale),
      variacao: comparar ? comoVariacao(variacaoPontos(resumo.taxaEncaminhar, anterior.taxaEncaminhar), "pp", locale) : null,
      detalhe: t("kpiDe", { n: resumo.encaminhar, total: resumo.validas }),
    },
    {
      rotulo: t("kpiReprovadas"),
      valor: formatarPorcentagem(resumo.taxaReprovar, locale),
      variacao: comparar ? comoVariacao(variacaoPontos(resumo.taxaReprovar, anterior.taxaReprovar), "pp", locale) : null,
      detalhe: t("kpiDe", { n: resumo.reprovar, total: resumo.validas }),
    },
  ];

  const porTipo = (["RECLAMACAO", "COMENTARIO"] as const)
    .map((tipo) => ({ tipo, resumo: resumirDecisoes(logs.filter((log) => log.alvoTipo === tipo)) }))
    .filter(({ resumo: r }) => r.total > 0);

  // Janela do gráfico: o período escolhido; em "todos", da primeira análise até agora.
  const primeira = logs.reduce((menor, log) => Math.min(menor, log.createdAt.getTime()), agora.getTime());
  const de = dados.inicio ?? new Date(primeira);
  const granularidade = escolherGranularidade(Math.ceil((agora.getTime() - de.getTime()) / MS_DIA) + 1);
  const buckets = volumePorPeriodo(logs, de, agora, granularidade);

  const scoresReclamacao = logs
    .filter((log) => log.alvoTipo === "RECLAMACAO" && !ehFalhaDaIA(log))
    .map((log) => log.scoreGeral);

  return (
    <main className={containerLargo}>
      {cabecalho}

      {dados.truncado && (
        <Aviso tom="atencao">
          {t("truncado", { max: formatarNumero(LIMITE_LINHAS_ESTATISTICAS, locale) })}
        </Aviso>
      )}

      <Kpis
        itens={kpis}
        rotuloComparacao={t("vsAnterior")}
        descricaoComparacao={t("vsAnteriorDescricao")}
      />

      <FilaAgora filas={filas} />

      <GraficoVolume buckets={buckets} granularidade={granularidade} />

      <div className="grid gap-6 lg:grid-cols-2">
        <SecaoEstatistica id="destino" titulo={t("destinoTitulo")} descricao={t("destinoDescricao")}>
          <div className="flex flex-col gap-6">
            {porTipo.map(({ tipo, resumo: r }) => (
              <div key={tipo} className="flex flex-col gap-2.5">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {tipo === "RECLAMACAO" ? t("reclamacoes") : t("comentarios")}{" "}
                  <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">({r.validas})</span>
                </p>
                <BarraDecisoes
                  contagens={{
                    APROVAR: r.aprovar,
                    ENCAMINHAR_REVISAO: r.encaminhar,
                    REPROVAR: r.reprovar,
                  }}
                />
                {r.falhas > 0 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t("falhasForaDaConta", { count: r.falhas })}</p>
                )}
              </div>
            ))}
          </div>
        </SecaoEstatistica>

        {scoresReclamacao.length > 0 && (
          <HistogramaPontuacoes
            faixas={histogramaScore(scoresReclamacao)}
            mediana={percentil(scoresReclamacao, 0.5)}
          />
        )}
      </div>

      <EixosQueDisparam
        grupos={[
          { tipo: "RECLAMACAO", corte: LIMITE_REVISAO, dados: disparosPorEixo(logs, "RECLAMACAO", LIMITE_REVISAO) },
          {
            tipo: "COMENTARIO",
            corte: LIMITE_REPROVACAO_COMENTARIO,
            dados: disparosPorEixo(logs, "COMENTARIO", LIMITE_REPROVACAO_COMENTARIO),
          },
        ]}
      />

      <IaVersusHumano
        reclamacoes={revisaoHumana(logs, "RECLAMACAO")}
        comentarios={revisaoHumana(logs, "COMENTARIO")}
        motivos={motivosDeRevisao(logs)}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <DenunciasDoPeriodo resumo={resumirDenuncias(dados.denuncias)} />
        <ConsumoDoModelo consumo={consumoDoModelo(logs)} />
      </div>

      <VersoesDoPrompt linhas={porVersaoDoPrompt(logs)} />
    </main>
  );
}
