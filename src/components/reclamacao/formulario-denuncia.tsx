import { getTranslations } from "next-intl/server";

import { Campo } from "@/components/formulario/campo";
import { BotaoAcao, FormularioAcao } from "@/components/ui/formulario-acao";
import type { ResultadoAcao } from "@/lib/acoes/resultado";
import { botaoPrimario, botaoSecundario, campoInput, painelSuave } from "@/lib/estilos";

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
  id,
  // "botao" é o gatilho largo ao lado de "também sofro com isso" (nível
  // reclamação); "link" é mais discreto, para caber ao lado de cada
  // comentário/resposta sem competir visualmente com o texto.
  estilo = "link",
}: {
  action: (formData: FormData) => Promise<ResultadoAcao>;
  // Prefixo único dos ids dos campos (há um formulário por comentário na página).
  id: string;
  estilo?: "botao" | "link";
}) {
  const t = await getTranslations("ReclamacaoDetalhe");
  const tMotivo = await getTranslations("MotivoDenuncia");

  return (
    <details className={estilo === "botao" ? "w-full" : "w-fit open:w-full open:max-w-sm"}>
      <summary
        className={
          estilo === "botao"
            ? `${botaoSecundario} w-full cursor-pointer list-none text-danger-ink`
            : "inline-flex w-fit cursor-pointer list-none items-center text-xs font-semibold text-danger-ink hover:underline"
        }
      >
        {t("denunciar")}
      </summary>
      <FormularioAcao
        action={action}
        limparAoSucesso
        recolherAoSucesso
        className={`animate-fade-in mt-3 flex flex-col gap-4 ${painelSuave}`}
      >
        <Campo id={`${id}-motivo`} rotulo={t("motivo")}>
          <select id={`${id}-motivo`} name="motivo" required defaultValue="" className={campoInput}>
            <option value="" disabled>
              —
            </option>
            {MOTIVOS_DENUNCIA.map((valor) => (
              <option key={valor} value={valor}>
                {tMotivo(valor)}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id={`${id}-descricao`} rotulo={t("descricaoOpcional")}>
          <textarea id={`${id}-descricao`} name="descricao" rows={2} className={campoInput} />
        </Campo>
        <label className="flex items-start gap-2.5 text-xs text-ink-muted">
          <input
            type="checkbox"
            name="declaracaoVeracidade"
            required
            className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
          />
          <span>{t("declaracaoBoaFe")}</span>
        </label>
        <BotaoAcao className={`${botaoPrimario} w-fit`}>{t("enviarDenuncia")}</BotaoAcao>
      </FormularioAcao>
    </details>
  );
}
