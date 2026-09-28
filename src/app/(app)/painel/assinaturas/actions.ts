"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/lib/sessao";

// Sentinel de categoriaChave pra "todas as categorias" - precisa bater com
// o default da coluna no schema.prisma (AssinaturaCidade.categoriaChave).
const CATEGORIA_CHAVE_TODAS = "__todas__";

export type AssinaturaFormState = { erro?: string } | undefined;

export async function criarAssinatura(
  _state: AssinaturaFormState,
  formData: FormData
): Promise<AssinaturaFormState> {
  const t = await getTranslations("Assinaturas");
  const session = await exigirSessao();

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

  // categoriaChave nunca é nula (ao contrário de categoriaId) - é o que a
  // unique constraint do banco usa de verdade pra impedir duplicata,
  // porque MySQL trata NULL como distinto num índice único e deixaria
  // passar duas assinaturas "toda a cidade" pra mesma pessoa/cidade.
  const categoriaChave = categoriaId ?? CATEGORIA_CHAVE_TODAS;

  try {
    await prisma.assinaturaCidade.create({
      data: { userId: session.user.id, cidadeId, categoriaId, categoriaChave },
    });
  } catch (erro) {
    // P2002 = violou a unique constraint - alguém (ou a mesma pessoa em
    // duas abas/cliques) já criou esta assinatura entre a checagem acima
    // e este create(). Sem capturar isso, duplo-clique/duas abas abertas
    // conseguiam criar duas linhas idênticas antes de qualquer uma
    // terminar de gravar.
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      return { erro: t("erroJaAssina") };
    }
    throw erro;
  }

  revalidatePath("/painel/assinaturas");
  revalidatePath(`/cidades/${cidade.slug}`);
}

export async function cancelarAssinatura(assinaturaId: string) {
  const session = await exigirSessao();

  // deleteMany (não delete) pra checar dono e existência numa query só,
  // sem lançar quando o id não pertence a este usuário (evita um usuário
  // cancelar a assinatura de outro só adivinhando o id).
  await prisma.assinaturaCidade.deleteMany({
    where: { id: assinaturaId, userId: session.user.id },
  });

  revalidatePath("/painel/assinaturas");
}
