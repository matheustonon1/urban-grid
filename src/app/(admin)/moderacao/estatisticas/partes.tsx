import { useTranslations } from "next-intl";

import { COR_DECISAO } from "@/components/moderacao/barra-decisoes";

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
      <summary className="inline-flex cursor-pointer items-center gap-1.5 rounded text-ink-muted hover:text-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        {t("verComoTabela")}
      </summary>
      <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-line">
        <table className="w-full text-left text-xs tabular-nums">
          <thead className="sticky top-0 bg-sunken text-ink-muted">
            <tr>
              {cabecalhos.map((cabecalho, i) => (
                <th key={cabecalho} scope="col" className={`px-3 py-2 font-medium ${i > 0 ? "text-right" : ""}`}>
                  {cabecalho}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {linhas.map((linha, i) => (
              <tr key={i}>
                {linha.map((celula, j) => (
                  <td
                    key={j}
                    className={`px-3 py-1.5 text-ink-2 ${j > 0 ? "text-right font-mono" : ""}`}
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

export const COR_FALHA = "bg-ink-faint";

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
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink-2">
      {itens.map((item) => (
        <li key={item.chave} className="flex items-center gap-1.5">
          <span aria-hidden className={`h-2.5 w-2.5 rounded-sm ${item.cor}`} />
          {item.rotulo}
        </li>
      ))}
    </ul>
  );
}
