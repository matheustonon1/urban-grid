import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  DESTINO_ATIVAR_DOIS_FATORES,
  faltaAtivarDoisFatores,
} from "@/lib/seguranca/doisFatoresObrigatorios";

// Rede de segurança extra além da checagem que cada page.tsx/actions.ts já
// faz sozinho (não existe layout.tsx compartilhado nessas áreas) - se uma
// página ou server action nova esquecer de chamar seu guard, isso ainda
// barra o acesso antes de qualquer HTML ou dado sensível sair do servidor.
// Server Functions (server actions) postam para a própria URL da página
// que as renderiza, então o matcher abaixo intercepta tanto o carregamento
// da página quanto as ações disparadas nela.
const PREFIXOS_ADMIN_OU_MODERADOR = ["/moderacao", "/denuncias"];
const PREFIXOS_SOMENTE_ADMIN = ["/orgaos-categorias", "/solicitacoes-orgao"];

function combina(pathname: string, prefixo: string): boolean {
  return pathname === prefixo || pathname.startsWith(`${prefixo}/`);
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const papel = req.auth?.user?.papel;

  const exigeAdminOuModerador = PREFIXOS_ADMIN_OU_MODERADOR.some((prefixo) =>
    combina(pathname, prefixo)
  );
  const exigeSomenteAdmin = PREFIXOS_SOMENTE_ADMIN.some((prefixo) => combina(pathname, prefixo));
  const exigeOrgao = pathname === "/orgao";

  if (!req.auth) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const papelPermitido =
    (exigeAdminOuModerador && (papel === "ADMIN" || papel === "MODERADOR")) ||
    (exigeSomenteAdmin && papel === "ADMIN") ||
    (exigeOrgao && papel === "ORGAO");

  if (!papelPermitido) {
    return NextResponse.redirect(new URL("/painel", req.nextUrl));
  }

  // O órgão entra no painel só com o segundo fator ativo; sem ele, vai direto para a tela que
  // o ativa (a mesma regra vale em exigirOrgao(), que cobre também as server actions).
  if (exigeOrgao && faltaAtivarDoisFatores({ papel, doisFatores: req.auth.user?.doisFatores })) {
    return NextResponse.redirect(new URL(DESTINO_ATIVAR_DOIS_FATORES, req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/moderacao",
    "/moderacao/:path*",
    "/denuncias",
    "/denuncias/:path*",
    "/orgaos-categorias",
    "/orgaos-categorias/:path*",
    "/solicitacoes-orgao",
    "/solicitacoes-orgao/:path*",
    "/orgao",
  ],
};
