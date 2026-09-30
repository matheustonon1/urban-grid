import { getTranslations } from "next-intl/server";

import { botaoPrimario, botaoSecundario, campoInput, cartao } from "@/lib/estilos";

const MOTIVOS_DENUNCIA = [
  "OFENSIVO",
  "SPAM",
  "DESINFORMACAO",
  "FORA_DE_ESCOPO",
  "DADOS_PESSOAIS",
  "DUPLICADA",
  "OUTRO",
] as const;

// Compartilhado entre a denúncia de uma reclamação inteira e a denúncia
// de um comentário específico (ver criarDenuncia/criarDenunciaComentario
// em reclamacoes/[protocolo]/actions.ts) - mesmo formulário, só muda a
// action ligada a cada um.
export async function FormularioDenuncia({
  action,
  largura = "w-72",
  // "pill" imita o mesmo botão secundário ao lado de "também sofro com
  // isso" (nível reclamação); "link" é mais discreto, para caber ao lado
  // de cada comentário/resposta sem competir visualmente com o texto.
  estilo = "link",
}: {
  action: (formData: FormData) => void | Promise<void>;
  largura?: string;
  estilo?: "pill" | "link";
}) {
  const t = await getTranslations("ReclamacaoDetalhe");
  const tMotivo = await getTranslations("MotivoDenuncia");

  return (
    <details className="w-fit">
      <summary
        className={
          estilo === "pill"
            ? `${botaoSecundario} inline-flex w-fit cursor-pointer list-none text-red-700 dark:text-red-400`
            : "inline-flex w-fit cursor-pointer list-none items-center text-xs font-medium text-red-700 hover:underline dark:text-red-400"
        }
      >
        {t("denunciar")}
      </summary>
      <form
        action={action}
        className={`animate-fade-in mt-2 flex ${largura} flex-col gap-2 ${cartao}`}
      >
        <select name="motivo" required defaultValue="" className={campoInput}>
          <option value="" disabled>
            {t("motivo")}
          </option>
          {MOTIVOS_DENUNCIA.map((valor) => (
            <option key={valor} value={valor}>
              {tMotivo(valor)}
            </option>
          ))}
        </select>
        <textarea
          name="descricao"
          placeholder={t("descricaoOpcional")}
          rows={2}
          className={campoInput}
        />
        <label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
          <input type="checkbox" name="declaracaoVeracidade" required className="mt-0.5" />
          <span>{t("declaracaoBoaFe")}</span>
        </label>
        <button type="submit" className={`${botaoPrimario} w-fit`}>
          {t("enviarDenuncia")}
        </button>
      </form>
    </details>
  );
}
