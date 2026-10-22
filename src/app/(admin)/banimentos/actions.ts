"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { informacao, sucesso, type ResultadoAcao } from "@/lib/acoes/resultado";

import { exigirAdmin } from "../solicitacoes-orgao/exigir-admin";

// Único jeito de tirar um banimento antes do prazo - banirAutor() (em
// denuncias/actions.ts) só sabe setar banidoAte, nunca limpar. Sem isto,
// um banimento aplicado por engano (ou uma denúncia revertida depois) só
// se corrigia mexendo direto no banco.
export async function reverterBanimento(userId: string): Promise<ResultadoAcao> {
  await exigirAdmin();
  const t = await getTranslations("Banimentos");

  const usuario = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  // Só limpa quem ainda está banido: outra pessoa pode já ter revertido entre
  // a página carregar e o clique (count 0), e sem a condição esta ação diria
  // "revertido" para uma conta que nunca esteve banida.
  const atualizacao = await prisma.user.updateMany({
    where: { id: userId, banidoAte: { gt: new Date() } },
    data: { banidoAte: null },
  });
  if (!usuario || atualizacao.count === 0) {
    revalidatePath("/banimentos");
    return informacao(t("jaSemBanimento"));
  }

  revalidatePath("/banimentos");

  return sucesso(t("banimentoRevertido", { nome: usuario.name ?? usuario.email }));
}
