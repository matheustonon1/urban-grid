import { redirect } from "next/navigation";

import { exigirSessao } from "@/lib/seguranca/sessao";

export async function exigirOrgao() {
  const session = await exigirSessao();

  if (session.user.papel !== "ORGAO" || !session.user.orgaoId) {
    redirect("/painel");
  }

  return session;
}
