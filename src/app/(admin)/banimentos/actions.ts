"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";

import { exigirAdmin } from "../solicitacoes-orgao/exigir-admin";

// Único jeito de tirar um banimento antes do prazo - banirAutor() (em
// denuncias/actions.ts) só sabe setar banidoAte, nunca limpar. Sem isto,
// um banimento aplicado por engano (ou uma denúncia revertida depois) só
// se corrigia mexendo direto no banco.
export async function reverterBanimento(userId: string) {
  await exigirAdmin();

  await prisma.user.update({
    where: { id: userId },
    data: { banidoAte: null },
  });

  revalidatePath("/banimentos");
}
