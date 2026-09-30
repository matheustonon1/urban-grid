"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { criarNotificacao } from "@/lib/notificacoes";

import { exigirModerador } from "../moderacao/exigir-moderador";
import { exigirAdmin } from "../solicitacoes-orgao/exigir-admin";

async function buscarDenunciaAberta(denunciaId: string) {
  return prisma.denuncia.findFirst({
    where: { id: denunciaId, status: "ABERTA" },
  });
}

export async function marcarImprocedente(denunciaId: string) {
  const session = await exigirModerador();

  const denuncia = await buscarDenunciaAberta(denunciaId);
  if (!denuncia) {
    return;
  }

  await prisma.denuncia.update({
    where: { id: denuncia.id },
    data: {
      status: "IMPROCEDENTE",
      analisadoPorId: session.user.id,
      analisadoEm: new Date(),
    },
  });

  revalidatePath("/denuncias");
}

// Compartilhado por marcarProcedente() e banirAutor() - banir o autor é,
// no mínimo, concordar que a denúncia procede (e normalmente mais grave
// que isso), então fecha a denúncia do mesmo jeito: aplica a consequência
// no alvo (arquiva a reclamação, ou reprova o comentário) e avisa quem
// postou. Sem isto, banirAutor() deixava a denúncia em ABERTA pra sempre,
// reaparecendo na fila mesmo com o problema já resolvido.
//
// Retorna o autorId de quem postou o conteúdo denunciado - banirAutor()
// precisa disso e não do resto (reclamação ou comentário completos), então
// devolve só o que é comum aos dois tipos de alvo em vez de um union type
// que cada chamador teria que desmembrar de novo.
async function resolverComoProcedente(
  denuncia: { id: string; alvoId: string; alvoTipo: string },
  moderadorId: string
): Promise<{ autorId: string } | null> {
  if (denuncia.alvoTipo === "RECLAMACAO") {
    const reclamacao = await prisma.reclamacao.findUnique({
      where: { id: denuncia.alvoId },
    });
    if (!reclamacao) {
      return null;
    }

    await prisma.$transaction([
      prisma.denuncia.update({
        where: { id: denuncia.id },
        data: { status: "PROCEDENTE", analisadoPorId: moderadorId, analisadoEm: new Date() },
      }),
      prisma.reclamacao.update({
        where: { id: reclamacao.id },
        data: { status: "ARQUIVADA" },
      }),
    ]);

    await criarNotificacao({
      userId: reclamacao.autorId,
      tipo: "MUDANCA_STATUS",
      titulo: "Reclamação arquivada",
      mensagem: `Sua reclamação "${reclamacao.titulo}" foi arquivada após denúncia procedente.`,
      reclamacaoId: reclamacao.id,
      protocolo: reclamacao.protocolo,
    });

    revalidatePath("/reclamacoes");
    revalidatePath(`/reclamacoes/${reclamacao.protocolo}`);

    return { autorId: reclamacao.autorId };
  }

  if (denuncia.alvoTipo === "COMENTARIO") {
    const comentario = await prisma.comentario.findUnique({
      where: { id: denuncia.alvoId },
      include: { reclamacao: { select: { protocolo: true } } },
    });
    if (!comentario) {
      return null;
    }

    await prisma.$transaction([
      prisma.denuncia.update({
        where: { id: denuncia.id },
        data: { status: "PROCEDENTE", analisadoPorId: moderadorId, analisadoEm: new Date() },
      }),
      // Mesmo campo que a fila de moderação por IA usa pra esconder um
      // comentário (statusModeracao !== "APROVADO" não aparece na
      // reclamação) - uma denúncia procedente tem o mesmo efeito prático
      // de uma reprovação por IA, só que decidida por uma pessoa.
      prisma.comentario.update({
        where: { id: comentario.id },
        data: { statusModeracao: "REPROVADO" },
      }),
    ]);

    await criarNotificacao({
      userId: comentario.autorId,
      tipo: "MUDANCA_STATUS",
      titulo: "Comentário removido",
      mensagem: "Um comentário seu foi removido depois de uma denúncia procedente.",
      protocolo: comentario.reclamacao.protocolo,
    });

    revalidatePath(`/reclamacoes/${comentario.reclamacao.protocolo}`);

    return { autorId: comentario.autorId };
  }

  return null;
}

export async function marcarProcedente(denunciaId: string) {
  const session = await exigirModerador();

  const denuncia = await buscarDenunciaAberta(denunciaId);
  if (!denuncia) {
    return;
  }

  await resolverComoProcedente(denuncia, session.user.id);

  revalidatePath("/denuncias");
}

const DIAS_BANIMENTO: Record<string, number> = {
  "7": 7,
  "30": 30,
  permanente: 100 * 365,
};

export async function banirAutor(denunciaId: string, formData: FormData) {
  const session = await exigirAdmin();

  const denuncia = await buscarDenunciaAberta(denunciaId);
  if (!denuncia) {
    return;
  }

  const duracao = String(formData.get("duracao"));
  const dias = DIAS_BANIMENTO[duracao];
  if (!dias) {
    return;
  }

  const resolvido = await resolverComoProcedente(denuncia, session.user.id);
  if (!resolvido) {
    return;
  }

  await prisma.user.update({
    where: { id: resolvido.autorId },
    data: { banidoAte: new Date(Date.now() + dias * 24 * 60 * 60 * 1000) },
  });

  revalidatePath("/denuncias");
}
