"use server";

import { revalidatePath } from "next/cache";

import { getTranslations } from "next-intl/server";

import { signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { falha, informacao, sucesso, type ResultadoAcao } from "@/lib/acoes/resultado";
import { criarTokenVerificacao, enviarEmailVerificacao } from "@/lib/email";
import { idiomaOuPadrao } from "@/i18n/config";
import { exigirSessao } from "@/lib/seguranca/sessao";
import { excedeuLimitePorIp } from "@/lib/seguranca/rateLimitMemoria";
import { ESCOPO_REENVIO_VERIFICACAO } from "@/lib/conta/verificacao";

export async function sair() {
  await signOut({ redirectTo: "/" });
}

export async function reenviarVerificacao(): Promise<ResultadoAcao> {
  const session = await exigirSessao();
  const t = await getTranslations("Conta");

  const usuario = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!usuario || usuario.emailVerified) {
    return informacao(t("emailJaVerificado"));
  }
  // Mesmo limite do botão de "Minha conta" (ver conta/actions.ts).
  if (excedeuLimitePorIp(ESCOPO_REENVIO_VERIFICACAO, usuario.id, 3, 10 * 60 * 1000)) {
    return falha(t("erroMuitosEnvios"));
  }

  const token = await criarTokenVerificacao(usuario.email);
  await enviarEmailVerificacao({
    email: usuario.email,
    token,
    locale: idiomaOuPadrao(usuario.idioma),
  });

  revalidatePath("/painel");

  return sucesso(t("verificacaoReenviada", { email: usuario.email }));
}
