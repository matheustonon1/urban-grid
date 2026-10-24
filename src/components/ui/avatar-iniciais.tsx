import { iniciaisDoNome } from "@/lib/util/texto";

// Quadrado de cantos curtos com as iniciais da pessoa (mesma família da marca).
// Decorativo (aria-hidden): o nome já aparece em texto ao lado, repetir seria
// ruído pra leitor de tela.
export function AvatarIniciais({ nome }: { nome: string }) {
  return (
    <span
      aria-hidden
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sunken text-xs font-semibold text-ink-2"
    >
      {iniciaisDoNome(nome)}
    </span>
  );
}
