"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";

import { exigirModerador } from "../exigir-moderador";

async function buscarLogPendente(comentarioId: string) {
  return prisma.logModeracao.findFirst({
    where: {
      alvoTipo: "COMENTARIO",
      alvoId: comentarioId,
      decisao: "REPROVAR",
      revisadoEm: null,
    },
    orderBy: { createdAt: "desc" },
  });
}

async function revalidarReclamacaoDoComentario(reclamacaoId: string) {
  const reclamacao = await prisma.reclamacao.findUnique({
    where: { id: reclamacaoId },
    select: { protocolo: true },
  });
  if (reclamacao) {
    revalidatePath(`/reclamacoes/${reclamacao.protocolo}`);
  }
}

// Comentário não tem fila de "aguardando revisão" (decisão da IA é
// sempre final na hora) - "revisar" aqui é sempre uma correção
// retroativa de um comentário já reprovado, feita a partir do log.
export async function aprovarComentarioReprovado(comentarioId: string) {
  const session = await exigirModerador();

  const comentario = await prisma.comentario.findUnique({ where: { id: comentarioId } });
  if (!comentario || comentario.statusModeracao !== "REPROVADO") {
    return;
  }

  const log = await buscarLogPendente(comentarioId);
  const agora = new Date();

  // updateMany com o status na condição - mesma guarda atômica usada em
  // moderacao/actions.ts (ver comentário lá): sem isso, dois cliques
  // quase simultâneos passavam ambos pela checagem acima antes de
  // qualquer um escrever.
  const aplicado = await prisma.$transaction(async (tx) => {
    const atualizacao = await tx.comentario.updateMany({
      where: { id: comentarioId, statusModeracao: "REPROVADO" },
      data: { statusModeracao: "APROVADO" },
    });
    if (atualizacao.count === 0) {
      return false;
    }
    if (log) {
      await tx.logModeracao.update({
        where: { id: log.id },
        data: { revisadoPorId: session.user.id, decisaoFinal: "APROVAR", revisadoEm: agora },
      });
    }
    return true;
  });

  if (!aplicado) {
    return;
  }

  await revalidarReclamacaoDoComentario(comentario.reclamacaoId);
  revalidatePath("/moderacao/comentarios");
  revalidatePath("/moderacao/historico/comentarios");
}

export async function confirmarRejeicaoComentario(comentarioId: string) {
  const session = await exigirModerador();

  const log = await buscarLogPendente(comentarioId);
  if (!log) {
    return;
  }

  // updateMany com revisadoEm ainda nulo na condição - evita que esta ação
  // e aprovarComentarioReprovado() (que também consome o mesmo log
  // pendente) processem o mesmo log duas vezes se disparadas quase ao
  // mesmo tempo pra decisões conflitantes.
  const atualizacao = await prisma.logModeracao.updateMany({
    where: { id: log.id, revisadoEm: null },
    data: { revisadoPorId: session.user.id, decisaoFinal: "REPROVAR", revisadoEm: new Date() },
  });
  if (atualizacao.count === 0) {
    return;
  }

  revalidatePath("/moderacao/comentarios");
  revalidatePath("/moderacao/historico/comentarios");
}
