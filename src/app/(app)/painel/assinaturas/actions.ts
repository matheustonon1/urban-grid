"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type AssinaturaFormState = { erro?: string } | undefined;

export async function criarAssinatura(
  _state: AssinaturaFormState,
  formData: FormData
): Promise<AssinaturaFormState> {
  const t = await getTranslations("Assinaturas");
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const cidadeId = formData.get("cidadeId");
  const categoriaIdBruto = formData.get("categoriaId");
  const categoriaId =
    typeof categoriaIdBruto === "string" && categoriaIdBruto ? categoriaIdBruto : null;

  if (typeof cidadeId !== "string" || !cidadeId) {
    return { erro: t("erroCidadeObrigatoria") };
  }

  const cidade = await prisma.cidade.findUnique({ where: { id: cidadeId } });
  if (!cidade) {
    return { erro: t("erroCidadeObrigatoria") };
  }

  if (categoriaId) {
    const categoria = await prisma.categoria.findUnique({ where: { id: categoriaId } });
    if (!categoria) {
      return { erro: t("erroCategoriaInvalida") };
    }
  }

  // A unique de (userId, cidadeId, categoriaId) no banco não pega
  // duplicata quando categoriaId é nulo (MySQL trata NULL como distinto
  // em índice único) - por isso a checagem aqui cobre os dois casos, em
  // vez de confiar só na constraint.
  const existente = await prisma.assinaturaCidade.findFirst({
    where: { userId: session.user.id, cidadeId, categoriaId },
  });
  if (existente) {
    return { erro: t("erroJaAssina") };
  }

  await prisma.assinaturaCidade.create({
    data: { userId: session.user.id, cidadeId, categoriaId },
  });

  revalidatePath("/painel/assinaturas");
  revalidatePath(`/cidades/${cidade.slug}`);
}

export async function cancelarAssinatura(assinaturaId: string) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  // deleteMany (não delete) pra checar dono e existência numa query só,
  // sem lançar quando o id não pertence a este usuário (evita um usuário
  // cancelar a assinatura de outro só adivinhando o id).
  await prisma.assinaturaCidade.deleteMany({
    where: { id: assinaturaId, userId: session.user.id },
  });

  revalidatePath("/painel/assinaturas");
}
