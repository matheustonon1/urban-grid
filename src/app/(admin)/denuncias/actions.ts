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
// que isso), então fecha a denúncia do mesmo jeito: arquiva a reclamação
// e avisa o autor. Sem isto, banirAutor() deixava a denúncia em ABERTA
// pra sempre, reaparecendo na fila mesmo com o problema já resolvido.
async function resolverComoProcedente(
  denuncia: { id: string; alvoId: string },
  moderadorId: string
) {
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

  return reclamacao;
}

export async function marcarProcedente(denunciaId: string) {
  const session = await exigirModerador();

  const denuncia = await buscarDenunciaAberta(denunciaId);
  if (!denuncia || denuncia.alvoTipo !== "RECLAMACAO") {
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
  if (!denuncia || denuncia.alvoTipo !== "RECLAMACAO") {
    return;
  }

  const duracao = String(formData.get("duracao"));
  const dias = DIAS_BANIMENTO[duracao];
  if (!dias) {
    return;
  }

  const reclamacao = await resolverComoProcedente(denuncia, session.user.id);
  if (!reclamacao) {
    return;
  }

  await prisma.user.update({
    where: { id: reclamacao.autorId },
    data: { banidoAte: new Date(Date.now() + dias * 24 * 60 * 60 * 1000) },
  });

  revalidatePath("/denuncias");
}
