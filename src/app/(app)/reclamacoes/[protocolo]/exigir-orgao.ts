import { redirect } from "next/navigation";

import {
  DESTINO_ATIVAR_DOIS_FATORES,
  faltaAtivarDoisFatores,
} from "@/lib/seguranca/doisFatoresObrigatorios";
import { exigirSessao } from "@/lib/seguranca/sessao";

export async function exigirOrgao() {
  const session = await exigirSessao();

  if (session.user.papel !== "ORGAO" || !session.user.orgaoId) {
    redirect("/painel");
  }

  // Conta de órgão sem o segundo fator não usa o painel nem responde: é levada a ativar. Vale
  // também para as server actions (responder, corrigir), que não podem depender de a tela ter
  // escondido o formulário.
  if (faltaAtivarDoisFatores(session.user)) {
    redirect(DESTINO_ATIVAR_DOIS_FATORES);
  }

  return session;
}
