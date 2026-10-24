import { Campo } from "@/components/formulario/campo";
import { BotaoAcao, FormularioAcao, type Confirmacao } from "@/components/ui/formulario-acao";
import type { ResultadoAcao } from "@/lib/acoes/resultado";
import { botaoPerigo, campoInput } from "@/lib/estilos";

// "Motivo + Rejeitar" das filas de decisão (fila de moderação, solicitações de
// órgão e de cidade): o motivo tem rótulo visível - placeholder some ao digitar
// e não é rótulo - e o botão de rejeitar fica na linha do campo. Os nomes
// (`motivo`) e o mínimo de 10 letras são o contrato das server actions. Com
// `confirmacao`, o botão abre o diálogo antes de enviar o motivo.
export function FormularioRejeicao({
  id,
  action,
  rotulo,
  botao,
  confirmacao,
}: {
  id: string;
  action: (formData: FormData) => Promise<ResultadoAcao>;
  rotulo: string;
  botao: string;
  confirmacao?: Confirmacao;
}) {
  return (
    <FormularioAcao
      action={action}
      confirmacao={confirmacao}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <div className="flex-1">
        <Campo id={id} rotulo={rotulo}>
          <textarea
            id={id}
            name="motivo"
            required
            minLength={10}
            rows={2}
            className={campoInput}
          />
        </Campo>
      </div>
      <BotaoAcao className={botaoPerigo}>{botao}</BotaoAcao>
    </FormularioAcao>
  );
}
