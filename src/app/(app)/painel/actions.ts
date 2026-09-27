"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { criarTokenVerificacao, enviarEmailVerificacao } from "@/lib/email";
import { idiomaOuPadrao } from "@/i18n/config";

export async function sair() {
  await signOut({ redirectTo: "/" });
}

export async function reenviarVerificacao() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const usuario = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!usuario || usuario.emailVerified) {
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
