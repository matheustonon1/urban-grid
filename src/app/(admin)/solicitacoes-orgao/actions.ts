"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import {
  criarTokenVerificacao,
  enviarEmailAcessoOrgao,
  enviarEmailSolicitacaoRejeitada,
} from "@/lib/email";

import { criarRejeitarSolicitacaoSchema } from "./definitions";
import { exigirAdmin } from "./exigir-admin";

export async function aprovarSolicitacao(solicitacaoId: string) {
  const session = await exigirAdmin();

  const solicitacao = await prisma.solicitacaoOrgao.findUnique({
    where: { id: solicitacaoId },
  });
  if (!solicitacao || solicitacao.status !== "PENDENTE") {
    return;
  }

  const usuarioExistente = await prisma.user.findUnique({
    where: { email: solicitacao.email },
  });
  if (usuarioExistente) {
    // E-mail já virou conta por outro caminho entre o pedido e agora -
    // não sobrescreve uma conta existente. Fica pendente pra um admin
    // resolver manualmente (rejeitar, ou o solicitante usar outro e-mail).
    return;
  }

  const agora = new Date();

  await prisma.$transaction(async (tx) => {
    const orgao = await tx.orgao.upsert({
      where: { cidadeId_nome: { cidadeId: solicitacao.cidadeId, nome: solicitacao.nomeOrgao } },
      update: {},
      create: {
        nome: solicitacao.nomeOrgao,
        sigla: solicitacao.sigla,
        cidadeId: solicitacao.cidadeId,
        email: solicitacao.email,
      },
    });

    await tx.user.create({
      data: {
        name: solicitacao.nomeResponsavel,
        email: solicitacao.email,
        telefone: solicitacao.telefone,
        papel: "ORGAO",
        orgaoId: orgao.id,
        cidadeId: solicitacao.cidadeId,
        emailVerified: agora,
        nivelVerificacao: "EMAIL",
      },
    });

    await tx.solicitacaoOrgao.update({
      where: { id: solicitacaoId },
      data: { status: "APROVADA", analisadoPorId: session.user.id, analisadoEm: agora },
    });
  });

  const token = await criarTokenVerificacao(solicitacao.email);
  await enviarEmailAcessoOrgao({
    email: solicitacao.email,
    token,
    nomeOrgao: solicitacao.nomeOrgao,
  });

  revalidatePath("/solicitacoes-orgao");
}

export async function rejeitarSolicitacao(solicitacaoId: string, formData: FormData) {
  const session = await exigirAdmin();

  const validado = criarRejeitarSolicitacaoSchema(await getTranslations("Moderacao")).safeParse({
    motivo: formData.get("motivo"),
  });
  if (!validado.success) {
    return;
  }

  const solicitacao = await prisma.solicitacaoOrgao.findUnique({
    where: { id: solicitacaoId },
  });
  if (!solicitacao || solicitacao.status !== "PENDENTE") {
    return;
  }

  await prisma.solicitacaoOrgao.update({
    where: { id: solicitacaoId },
    data: {
      status: "REJEITADA",
      motivoRejeicao: validado.data.motivo,
      analisadoPorId: session.user.id,
      analisadoEm: new Date(),
    },
  });

  await enviarEmailSolicitacaoRejeitada({
    email: solicitacao.email,
    motivo: validado.data.motivo,
  });

  revalidatePath("/solicitacoes-orgao");
}
