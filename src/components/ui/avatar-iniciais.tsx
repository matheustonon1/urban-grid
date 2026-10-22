import { iniciaisDoNome } from "@/lib/util/texto";

// Círculo com as iniciais da pessoa. Decorativo (aria-hidden): o nome já
// aparece em texto ao lado, repetir seria ruído pra leitor de tela.
export function AvatarIniciais({ nome }: { nome: string }) {
  return (
    <span
      aria-hidden
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200"
    >
      {iniciaisDoNome(nome)}
    </span>
  );
}
