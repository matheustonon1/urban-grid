import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { CadastroTipoSwitch } from "@/components/cadastro-tipo-switch";

export default async function CadastroPage({
  searchParams,
}: PageProps<"/cadastro">) {
  const session = await auth();
  if (session?.user) {
    redirect("/painel");
  }

  const { tipo } = await searchParams;
  const tipoInicial = tipo === "orgao" ? "orgao" : "pessoa";

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center gap-6 overflow-hidden p-8">
      <div
        aria-hidden
        className="animate-grid-drift bg-dot-grid pointer-events-none absolute inset-0 -z-20"
      />
      <div
        aria-hidden
        className="animate-float pointer-events-none absolute left-1/2 top-0 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl dark:bg-blue-500/10"
      />

      <div className="animate-fade-in flex w-full max-w-sm flex-col items-center gap-6">
        <CadastroTipoSwitch tipoInicial={tipoInicial} />
      </div>
    </main>
  );
}
