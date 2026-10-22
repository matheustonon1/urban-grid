"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { atencao, falha, informacao, sucesso, type ResultadoAcao } from "@/lib/acoes/resultado";
import {
  criarTokenVerificacao,
  enviarEmailAcessoOrgao,
  enviarEmailSolicitacaoRejeitada,
} from "@/lib/email";
import { idiomaOuPadrao } from "@/i18n/config";

import { criarRejeitarSolicitacaoSchema } from "./definitions";
import { exigirAdmin } from "./exigir-admin";

export async function aprovarSolicitacao(solicitacaoId: string): Promise<ResultadoAcao> {
  const session = await exigirAdmin();
  const t = await getTranslations("SolicitacoesOrgao");

  const solicitacao = await prisma.solicitacaoOrgao.findUnique({
    where: { id: solicitacaoId },
  });
  if (!solicitacao || solicitacao.status !== "PENDENTE") {
    return informacao(t("jaDecidida"));
  }

  const usuarioExistente = await prisma.user.findUnique({
    where: { email: solicitacao.email },
  });
  if (usuarioExistente) {
    // E-mail já virou conta por outro caminho entre o pedido e agora -
    // não sobrescreve uma conta existente. Fica pendente pra um admin
    // resolver manualmente (rejeitar, ou o solicitante usar outro e-mail).
    return falha(t("erroEmailJaTemConta", { email: solicitacao.email }));
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
    // Perdeu a corrida (outra aprovação/rejeição entrou antes) ou o e-mail virou
    // conta no meio do caminho - nos dois casos nada foi criado por esta ação.
    revalidatePath("/solicitacoes-orgao");
    return informacao(t("jaDecidida"));
  }

  const token = await criarTokenVerificacao(solicitacao.email);
  const envio = await enviarEmailAcessoOrgao({
    email: solicitacao.email,
    token,
    nomeOrgao: solicitacao.nomeOrgao,
    locale: idiomaOuPadrao(solicitacao.idioma),
  });

  revalidatePath("/solicitacoes-orgao");

  // A conta já foi criada de qualquer jeito: se o e-mail não saiu, o admin
  // precisa saber agora (e para onde ir), não descobrir dias depois que a pessoa
  // nunca recebeu o link.
  const params = { orgao: solicitacao.nomeOrgao, email: solicitacao.email };
  if (envio.status === "falhou") {
    return atencao(t("aprovadaEmailFalhou", { ...params, motivo: envio.motivo }));
  }
  if (envio.status === "simulado") {
    return atencao(t("aprovadaSimulado", params));
  }
  return sucesso(t("aprovadaEnviado", params));
}

export async function rejeitarSolicitacao(
  solicitacaoId: string,
  formData: FormData
): Promise<ResultadoAcao> {
  const session = await exigirAdmin();
  const t = await getTranslations("SolicitacoesOrgao");

  const validado = criarRejeitarSolicitacaoSchema(await getTranslations("Moderacao")).safeParse({
    motivo: formData.get("motivo"),
  });
  if (!validado.success) {
    return falha(validado.error.issues[0]?.message ?? t("jaDecidida"));
  }

  const solicitacao = await prisma.solicitacaoOrgao.findUnique({
    where: { id: solicitacaoId },
  });
  if (!solicitacao || solicitacao.status !== "PENDENTE") {
    return informacao(t("jaDecidida"));
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
    return informacao(t("jaDecidida"));
  }

  const envio = await enviarEmailSolicitacaoRejeitada({
    email: solicitacao.email,
    motivo: validado.data.motivo,
    locale: idiomaOuPadrao(solicitacao.idioma),
  });

  revalidatePath("/solicitacoes-orgao");

  if (envio.status === "falhou") {
    return atencao(t("rejeitadaEmailFalhou", { email: solicitacao.email, motivo: envio.motivo }));
  }
  return sucesso(t("rejeitadaOk", { email: solicitacao.email }));
}
