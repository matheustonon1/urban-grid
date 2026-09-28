"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { criarNotificacao } from "@/lib/notificacoes";

import { criarRejeitarSchema } from "./definitions";
import { exigirModerador } from "./exigir-moderador";

async function buscarLogPendente(reclamacaoId: string) {
  return prisma.logModeracao.findFirst({
    where: {
      alvoTipo: "RECLAMACAO",
      alvoId: reclamacaoId,
      decisao: "ENCAMINHAR_REVISAO",
      revisadoEm: null,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function aprovarReclamacao(reclamacaoId: string) {
  const session = await exigirModerador();

  const reclamacao = await prisma.reclamacao.findUnique({
    where: { id: reclamacaoId },
  });
  if (!reclamacao || reclamacao.status !== "AGUARDANDO_REVISAO") {
    return;
  }

  // Se o desfoque de rosto/placa falhou em alguma mídia (statusModeracao
  // fica em REVISAO_HUMANA e urlTratada nunca é preenchida), aprovar
  // aqui publicaria a foto crua. Recusa a aprovação até isso ser
  // resolvido - a reclamação pode ser rejeitada, mas não publicada
  // assim.
  const midiaComBlurPendente = await prisma.midia.findFirst({
    where: { reclamacaoId, statusModeracao: "REVISAO_HUMANA", urlTratada: null },
  });
  if (midiaComBlurPendente) {
    return;
  }

  const agora = new Date();
  const log = await buscarLogPendente(reclamacaoId);

  // updateMany com o status na condição (não update por id sozinho) faz
  // da leitura+escrita um passo atômico de verdade: se outra decisão
  // (aprovar ou rejeitar) já mudou o status entre o findUnique acima e
  // aqui, count vem 0 e nada mais acontece - sem isso, dois moderadores
  // clicando quase ao mesmo tempo (ou duplo clique) podiam aprovar E
  // rejeitar a mesma reclamação, cada write vencendo por último, com o
  // autor recebendo as duas notificações.
  const aplicado = await prisma.$transaction(async (tx) => {
    const atualizacao = await tx.reclamacao.updateMany({
      where: { id: reclamacaoId, status: "AGUARDANDO_REVISAO" },
      data: { status: "PUBLICADA", publicadaEm: agora },
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

  await criarNotificacao({
    userId: reclamacao.autorId,
    tipo: "RECLAMACAO_PUBLICADA",
    titulo: "Reclamação publicada",
    mensagem: `Sua reclamação "${reclamacao.titulo}" foi publicada.`,
    reclamacaoId: reclamacao.id,
    protocolo: reclamacao.protocolo,
  });

  revalidatePath("/moderacao");
  revalidatePath("/reclamacoes");
  revalidatePath(`/reclamacoes/${reclamacao.protocolo}`);
}

export async function rejeitarReclamacao(
  reclamacaoId: string,
  formData: FormData
) {
  const session = await exigirModerador();

  const validado = criarRejeitarSchema(await getTranslations("Moderacao")).safeParse({
    motivo: formData.get("motivo"),
  });
  if (!validado.success) {
    return;
  }

  const reclamacao = await prisma.reclamacao.findUnique({
    where: { id: reclamacaoId },
  });
  if (!reclamacao || reclamacao.status !== "AGUARDANDO_REVISAO") {
    return;
  }

  const agora = new Date();
  const log = await buscarLogPendente(reclamacaoId);

  // Mesma guarda atômica de aprovarReclamacao() - ver comentário lá.
  const aplicado = await prisma.$transaction(async (tx) => {
    const atualizacao = await tx.reclamacao.updateMany({
      where: { id: reclamacaoId, status: "AGUARDANDO_REVISAO" },
      data: { status: "REJEITADA", motivoRejeicao: validado.data.motivo },
    });
    if (atualizacao.count === 0) {
      return false;
    }
    if (log) {
      await tx.logModeracao.update({
        where: { id: log.id },
        data: { revisadoPorId: session.user.id, decisaoFinal: "REPROVAR", revisadoEm: agora },
      });
    }
    return true;
  });

  if (!aplicado) {
    return;
  }

  await criarNotificacao({
    userId: reclamacao.autorId,
    tipo: "RECLAMACAO_REJEITADA",
    titulo: "Reclamação rejeitada",
    mensagem: `Sua reclamação "${reclamacao.titulo}" foi rejeitada: ${validado.data.motivo}`,
    reclamacaoId: reclamacao.id,
    protocolo: reclamacao.protocolo,
  });

  revalidatePath("/moderacao");
  revalidatePath("/reclamacoes");
  revalidatePath(`/reclamacoes/${reclamacao.protocolo}`);
}
