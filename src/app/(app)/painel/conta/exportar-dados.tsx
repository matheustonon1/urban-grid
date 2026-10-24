import { Database, Download } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { botaoSecundario, cartaoSecao } from "@/lib/estilos";
import { CabecalhoCartao } from "@/components/ui/cabecalho-cartao";

export async function ExportarDados() {
  const t = await getTranslations("Conta");

  return (
    <section className={`flex flex-col gap-3 ${cartaoSecao}`}>
      <CabecalhoCartao icone={Database} titulo={t("privacidadeDados")} />
      <p className="text-sm text-ink-muted">{t("exportarDadosDesc")}</p>
      {/* <a>, não <Link>: é um download, e o Link pré-carregaria a rota (gerando o arquivo à toa). */}
      <a href="/painel/conta/exportar" download className={`${botaoSecundario} w-fit`}>
        <Download className="h-4 w-4" aria-hidden />
        {t("baixarMeusDados")}
      </a>
    </section>
  );
}
