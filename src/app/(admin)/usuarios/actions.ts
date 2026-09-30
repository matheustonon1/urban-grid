"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";

import { criarAlterarPapelSchema } from "./definitions";
import { exigirAdmin } from "../solicitacoes-orgao/exigir-admin";

// Único jeito de alguém virar MODERADOR/ADMIN hoje era escrever direto no
// banco (seed ou acesso manual) - não existia nenhuma tela pra promover
// (ou rebaixar) um usuário pela própria aplicação.
export async function alterarPapelUsuario(userId: string, formData: FormData) {
  const session = await exigirAdmin();

  // Bloqueia alterar o próprio papel em vez de tentar prever todo caso de
  // borda de "é o último admin?" - mais simples e mais seguro: qualquer
  // mudança de privilégio de uma conta passa pelo crivo de outra pessoa,
  // nunca só de quem seria afetado por ela.
  if (userId === session.user.id) {
    return;
  }

  const t = await getTranslations("Usuarios");
  const validado = criarAlterarPapelSchema(t).safeParse({ papel: formData.get("papel") });
  if (!validado.success) {
    return;
  }

  const usuario = await prisma.user.findUnique({ where: { id: userId } });
  // ORGAO fica de fora daqui (ver comentário em ./definitions) - nada a
  // fazer com uma conta desse papel nesta tela.
  if (!usuario || usuario.papel === "ORGAO") {
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { papel: validado.data.papel },
  });

  revalidatePath("/usuarios");
}
