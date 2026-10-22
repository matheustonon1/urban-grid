import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Marca } from "@/components/ui/marca";

// Rodapé institucional. Não repete os links do cabeçalho (Reclamações,
// Transparência): o mesmo rótulo em dois lugares da página quebra o
// getByRole do E2E por modo estrito e não ajuda ninguém - quem está no fim da
// página já tem o cabeçalho fixo no topo.
export async function Rodape() {
  const t = await getTranslations("Footer");

  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-8 md:flex-row md:items-start md:justify-between">
        <div className="flex max-w-sm flex-col gap-3">
          <Marca />
          <p className="text-sm leading-relaxed text-ink-muted">{t("descricao")}</p>
        </div>

        <nav aria-label={t("navegacao")} className="flex flex-col gap-2.5 text-sm">
          <span className="kicker">{t("participe")}</span>
          <Link href="/cidades/solicitar" className="text-ink-2 hover:text-brand hover:underline">
            {t("incluirCidade")}
          </Link>
          <Link href="/cadastro?tipo=orgao" className="text-ink-2 hover:text-brand hover:underline">
            {t("acessoOrgaos")}
          </Link>
          <Link href="/termos" className="text-ink-2 hover:text-brand hover:underline">
            {t("termos")}
          </Link>
        </nav>
      </div>

      <div className="border-t border-line">
        <p className="kicker mx-auto max-w-6xl px-4 py-4 sm:px-8">{t("tcc")}</p>
      </div>
    </footer>
  );
}
