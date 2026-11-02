"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function marcarNotificacaoLida(notificacaoId: string) {
  const session = await auth();
  if (!session?.user) {
    return;
  }

  await prisma.notificacao.updateMany({
    where: { id: notificacaoId, userId: session.user.id },
    data: { lida: true },
  });

  revalidatePath("/", "layout");
}

export async function marcarTodasLidas() {
  const session = await auth();
  if (!session?.user) {
    return;
  }

  await prisma.notificacao.updateMany({
    where: { userId: session.user.id, lida: false },
    data: { lida: true },
  });

  revalidatePath("/", "layout");
}
