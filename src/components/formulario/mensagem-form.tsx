import { Aviso } from "@/components/ui/aviso";
import type { TomRetorno } from "@/lib/acoes/resultado";

// Mensagem de retorno de um formulário com estado (useActionState): sucesso e
// erro não podem parecer a mesma frase cinza. O tom vem de `tipo`; sem ele, a
// mensagem é um erro - o caso mais comum, e o que não pode passar despercebido.
export function MensagemForm({
  estado,
}: {
  estado?: { mensagem?: string; tipo?: TomRetorno } | null;
}) {
  if (!estado?.mensagem) return null;

  return <Aviso tom={estado.tipo ?? "erro"}>{estado.mensagem}</Aviso>;
}
