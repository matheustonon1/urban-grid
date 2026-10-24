import { useTranslations } from "next-intl";

import { Aviso } from "@/components/ui/aviso";

// Termos e Política de Privacidade: texto longo, então tipografia de leitura
// (corpo 16px, entrelinha folgada, medida limitada pelo contêiner). Usado na
// página /termos e no modal do cadastro.
export function TermosConteudo() {
  const t = useTranslations("Termos");

  return (
    <div className="flex flex-col gap-8">
      <Aviso tom="atencao">{t("aviso")}</Aviso>

      <section className="flex flex-col gap-3 border-t-2 border-ink pt-4">
        <h2 className="text-xl font-extrabold tracking-tight text-ink">{t("secao1Titulo")}</h2>
        <p className="leading-relaxed text-ink-2">{t("secao1Paragrafo1")}</p>
        <p className="leading-relaxed text-ink-2">{t("secao1Paragrafo2")}</p>
      </section>

      <section className="flex flex-col gap-3 border-t-2 border-ink pt-4">
        <h2 className="text-xl font-extrabold tracking-tight text-ink">{t("secao2Titulo")}</h2>
        <p className="leading-relaxed text-ink-2">{t("secao2Paragrafo1")}</p>
        <p className="leading-relaxed text-ink-2">{t("secao2Paragrafo2")}</p>
        <p className="leading-relaxed text-ink-2">{t("secao2Paragrafo3")}</p>
      </section>
    </div>
  );
}
