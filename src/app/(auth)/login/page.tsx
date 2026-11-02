import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { PaginaAuth } from "@/components/ui/pagina-auth";
import { caminhoInternoSeguro, destinoPosLogin } from "@/lib/seguranca/destinoLogin";

import { FormularioLogin } from "./formulario";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { callbackUrl } = await searchParams;

  const session = await auth();
  if (session?.user) {
    redirect(destinoPosLogin(session.user.papel, callbackUrl));
  }

  const t = await getTranslations("Login");

  return (
    <PaginaAuth titulo={t("titulo")}>
      {/* Só um caminho interno chega ao formulário; a action confere de novo. */}
      <FormularioLogin callbackUrl={caminhoInternoSeguro(callbackUrl) ?? undefined} />
    </PaginaAuth>
  );
}
