import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { auth } from "@/auth";

import { FormularioLogin } from "./formulario";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/painel");
  }

  const t = await getTranslations("Login");

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
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {t("titulo")}
        </h1>

        <FormularioLogin />
      </div>
    </main>
  );
}
