import { cache } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";

// Sessão do usuário para os Server Components (cabeçalho, página, guards). O callback `jwt`
// revalida a conta no banco a CADA chamada de `auth()` (senha trocada, banimento, conta
// excluída, 2FA: ver src/auth.ts), e uma mesma renderização chamava `auth()` várias vezes -
// o cabeçalho, a página e cada guard -, repetindo a mesma consulta. `cache` do React faz as
// chamadas da mesma requisição compartilharem uma só leitura; a revalidação continua a cada
// requisição. Quem lê a sessão fora da renderização (Server Actions, proxy.ts) segue usando
// `auth` direto.
export const obterSessao = cache(() => auth());

// Parte compartilhada dos guards de página (exigirModerador, exigirOrgao):
// confirma que há sessão, manda pro login se não houver. Cada guard
// específico continua checando o papel/condição dele por conta própria -
// as regras são diferentes o bastante (OR de dois papéis vs. papel +
// orgaoId) pra não valer a pena forçar uma única função genérica.
export async function exigirSessao() {
  const session = await obterSessao();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}
