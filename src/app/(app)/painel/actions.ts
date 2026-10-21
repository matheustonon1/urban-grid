"use server";

import { revalidatePath } from "next/cache";

import { signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { criarTokenVerificacao, enviarEmailVerificacao } from "@/lib/email";
import { idiomaOuPadrao } from "@/i18n/config";
import { exigirSessao } from "@/lib/sessao";
import { excedeuLimitePorIp } from "@/lib/rateLimitMemoria";
import { ESCOPO_REENVIO_VERIFICACAO } from "@/lib/verificacao";

export async function sair() {
  await signOut({ redirectTo: "/" });
}

export async function reenviarVerificacao() {
  const session = await exigirSessao();

  const usuario = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!usuario || usuario.emailVerified) {
    return;
  }
  // Mesmo limite do botão de "Minha conta" (ver conta/actions.ts). Esta
  // action é usada direto como `<form action>` e só pode devolver void,
  // então acima do limite simplesmente não envia.
  if (excedeuLimitePorIp(ESCOPO_REENVIO_VERIFICACAO, usuario.id, 3, 10 * 60 * 1000)) {
    return;
  }

  const token = await criarTokenVerificacao(usuario.email);
  await enviarEmailVerificacao({
    email: usuario.email,
    token,
    locale: idiomaOuPadrao(usuario.idioma),
  });

  revalidatePath("/painel");
}
