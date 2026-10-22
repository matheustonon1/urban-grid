import type { ComponentProps } from "react";

import { Campo } from "@/components/formulario/campo";
import { botaoPerigo, campoInput } from "@/lib/estilos";

// "Motivo + Rejeitar" das filas de decisão (fila de moderação, solicitações de
// órgão e de cidade): o motivo tem rótulo visível - placeholder some ao digitar
// e não é rótulo - e o botão de rejeitar fica na linha do campo. Os nomes
// (`motivo`) e o mínimo de 10 letras são o contrato das server actions.
export function FormularioRejeicao({
  id,
  action,
  rotulo,
  botao,
}: {
  id: string;
  action: ComponentProps<"form">["action"];
  rotulo: string;
  botao: string;
}) {
  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
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
      <button type="submit" className={botaoPerigo}>
        {botao}
      </button>
    </form>
  );
}
