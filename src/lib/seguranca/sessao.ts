import { redirect } from "next/navigation";

import { auth } from "@/auth";

// Parte compartilhada dos guards de página (exigirModerador, exigirOrgao):
// confirma que há sessão, manda pro login se não houver. Cada guard
// específico continua checando o papel/condição dele por conta própria -
// as regras são diferentes o bastante (OR de dois papéis vs. papel +
// orgaoId) pra não valer a pena forçar uma única função genérica.
export async function exigirSessao() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}
