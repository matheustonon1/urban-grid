import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { COR_DECISAO } from "@/components/barra-decisoes";
import { cartaoSecao } from "@/lib/estilos";

// Bloco de uma estatística: título, uma linha do que ela mede e o conteúdo.
// `lateral` fica à direita do título (um número-resumo, um filtro).
export function SecaoEstatistica({
  id,
  titulo,
  descricao,
  lateral,
  children,
}: {
  id: string;
  titulo: string;
  descricao?: ReactNode;
  lateral?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-titulo`} className={`flex min-w-0 flex-col gap-5 ${cartaoSecao}`}>
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2
            id={`${id}-titulo`}
            className="font-display text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100"
          >
            {titulo}
          </h2>
          {descricao && <p className="max-w-prose text-sm text-slate-500 dark:text-slate-400">{descricao}</p>}
        </div>
        {lateral}
      </header>
      {children}
    </section>
  );
}

// Todo gráfico tem um gêmeo em tabela: quem não enxerga cor, usa leitor de
// tela ou quer copiar os números encontra o mesmo dado aqui.
export function VerComoTabela({
  cabecalhos,
  linhas,
}: {
  cabecalhos: string[];
  linhas: (string | number)[][];
}) {
  const t = useTranslations("Estatisticas");
  return (
    <details className="group text-sm">
      <summary className="inline-flex cursor-pointer items-center gap-1.5 rounded text-slate-500 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:text-slate-400 dark:hover:text-slate-200">
        {t("verComoTabela")}
      </summary>
      <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-xs tabular-nums">
          <thead className="sticky top-0 bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              {cabecalhos.map((cabecalho, i) => (
                <th key={cabecalho} scope="col" className={`px-3 py-2 font-medium ${i > 0 ? "text-right" : ""}`}>
                  {cabecalho}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {linhas.map((linha, i) => (
              <tr key={i}>
                {linha.map((celula, j) => (
                  <td
                    key={j}
                    className={`px-3 py-1.5 text-slate-700 dark:text-slate-300 ${j > 0 ? "text-right font-mono" : ""}`}
                  >
                    {celula}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export const COR_FALHA = "bg-slate-400 dark:bg-slate-500";

// Legenda das decisões da IA (e, se houver, das falhas), na mesma ordem e com
// as mesmas cores das barras: cor identifica, o texto nomeia.
export function LegendaDecisoes({ comFalhas = false }: { comFalhas?: boolean }) {
  const t = useTranslations("Decisao");
  const tEst = useTranslations("Estatisticas");
  const itens = [
    { chave: "APROVAR", cor: COR_DECISAO.APROVAR, rotulo: t("APROVAR") },
    { chave: "ENCAMINHAR_REVISAO", cor: COR_DECISAO.ENCAMINHAR_REVISAO, rotulo: t("ENCAMINHAR_REVISAO") },
    { chave: "REPROVAR", cor: COR_DECISAO.REPROVAR, rotulo: t("REPROVAR") },
    ...(comFalhas ? [{ chave: "FALHA", cor: COR_FALHA, rotulo: tEst("falhaDaIA") }] : []),
  ];
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-slate-700 dark:text-slate-300">
      {itens.map((item) => (
        <li key={item.chave} className="flex items-center gap-1.5">
          <span aria-hidden className={`h-2.5 w-2.5 rounded-sm ${item.cor}`} />
          {item.rotulo}
        </li>
      ))}
    </ul>
  );
}
