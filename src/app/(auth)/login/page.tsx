import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { PaginaAuth } from "@/components/ui/pagina-auth";

import { FormularioLogin } from "./formulario";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/painel");
  }

  const t = await getTranslations("Login");

  return (
    <PaginaAuth titulo={t("titulo")}>
      <FormularioLogin />
    </PaginaAuth>
  );
}
