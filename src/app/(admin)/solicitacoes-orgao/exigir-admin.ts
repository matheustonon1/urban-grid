import { redirect } from "next/navigation";

import { exigirSessao } from "@/lib/seguranca/sessao";

// Aprovar uma solicitação de órgão cria uma conta com poder de postar
// "resposta oficial" em nome da prefeitura - ação sensível o bastante
// pra ficar restrita a ADMIN, no mesmo padrão já usado pra banimento.
export async function exigirAdmin() {
  const session = await exigirSessao();

  if (session.user.papel !== "ADMIN") {
    redirect("/painel");
  }

  return session;
}
