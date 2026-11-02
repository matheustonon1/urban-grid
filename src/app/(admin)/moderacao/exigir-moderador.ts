import { redirect } from "next/navigation";

import { exigirSessao } from "@/lib/seguranca/sessao";

export async function exigirModerador() {
  const session = await exigirSessao();

  if (session.user.papel !== "MODERADOR" && session.user.papel !== "ADMIN") {
    redirect("/painel");
  }

  return session;
}
