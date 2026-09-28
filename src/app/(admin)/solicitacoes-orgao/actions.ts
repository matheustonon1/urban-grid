"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import {
  criarTokenVerificacao,
  enviarEmailAcessoOrgao,
  enviarEmailSolicitacaoRejeitada,
} from "@/lib/email";
import { idiomaOuPadrao } from "@/i18n/config";

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

  // Duas guardas contra corrida, uma pra cada janela de tempo possível:
  // 1) updateMany com status:PENDENTE na condição - se outra aprovação/
  //    rejeição já mudou o status entre o findUnique acima e aqui, count
  //    vem 0 e a transação inteira é desfeita antes de criar nada.
  // 2) P2002 no e-mail do User - cobre alguém virar conta por outro
  //    caminho, ou duas solicitações com o mesmo e-mail sendo aprovadas
  //    quase ao mesmo tempo, DEPOIS da checagem usuarioExistente acima
  //    (que só pega o caso óbvio, não o raro). Sem isto, o segundo
  //    tx.user.create lançava um erro não tratado (500) em vez da
  //    situação já prevista logo acima ("fica pendente pra um admin
  //    resolver manualmente").
  const resultado = await prisma
    .$transaction(async (tx) => {
      const atualizacaoSolicitacao = await tx.solicitacaoOrgao.updateMany({
        where: { id: solicitacaoId, status: "PENDENTE" },
        data: { status: "APROVADA", analisadoPorId: session.user.id, analisadoEm: agora },
      });
      if (atualizacaoSolicitacao.count === 0) {
        return { ok: false as const };
      }

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
          idioma: solicitacao.idioma,
        },
      });

      return { ok: true as const };
    })
    .catch((erro) => {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
        return { ok: false as const };
      }
      throw erro;
    });

  if (!resultado.ok) {
    return;
  }

  const token = await criarTokenVerificacao(solicitacao.email);
  await enviarEmailAcessoOrgao({
    email: solicitacao.email,
    token,
    nomeOrgao: solicitacao.nomeOrgao,
    locale: idiomaOuPadrao(solicitacao.idioma),
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

  // updateMany com status:PENDENTE na condição - mesma guarda atômica de
  // aprovarSolicitacao() (ver comentário lá), evitando rejeitar (e
  // mandar e-mail) uma solicitação que outro admin já aprovou/rejeitou.
  const atualizacao = await prisma.solicitacaoOrgao.updateMany({
    where: { id: solicitacaoId, status: "PENDENTE" },
    data: {
      status: "REJEITADA",
      motivoRejeicao: validado.data.motivo,
      analisadoPorId: session.user.id,
      analisadoEm: new Date(),
    },
  });
  if (atualizacao.count === 0) {
    return;
  }

  await enviarEmailSolicitacaoRejeitada({
    email: solicitacao.email,
    motivo: validado.data.motivo,
    locale: idiomaOuPadrao(solicitacao.idioma),
  });

  revalidatePath("/solicitacoes-orgao");
}
