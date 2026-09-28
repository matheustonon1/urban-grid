"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { enviarEmailCidadeAprovada, enviarEmailSolicitacaoCidadeRejeitada } from "@/lib/email";
import { idiomaOuPadrao } from "@/i18n/config";
import { slugificar } from "@/lib/slug";

import { criarAprovarSolicitacaoCidadeSchema, criarRejeitarSolicitacaoCidadeSchema } from "./definitions";
import { exigirAdmin } from "../solicitacoes-orgao/exigir-admin";

export async function aprovarSolicitacaoCidade(solicitacaoId: string, formData: FormData) {
  const session = await exigirAdmin();

  const validado = criarAprovarSolicitacaoCidadeSchema(
    await getTranslations("SolicitacoesCidade")
  ).safeParse({
    codigoIbge: formData.get("codigoIbge"),
  });
  if (!validado.success) {
    return;
  }

  const solicitacao = await prisma.solicitacaoCidade.findUnique({ where: { id: solicitacaoId } });
  if (!solicitacao || solicitacao.status !== "PENDENTE") {
    return;
  }

  const estado = await prisma.estado.findUnique({ where: { uf: solicitacao.uf } });
  if (!estado) {
    // Não deveria acontecer - uf já vem restrita à lista fixa de UFs no
    // envio da solicitação (ver UFS_BRASIL em cidades/solicitar/definitions.ts).
    return;
  }

  const agora = new Date();

  // Mesmo par de guardas de aprovarSolicitacao() em solicitacoes-orgao
  // (ver comentário lá): updateMany com status:PENDENTE fecha a corrida
  // entre o findUnique acima e esta escrita, e o catch de P2002 cobre
  // slug/código IBGE duplicado - por exemplo, duas aprovações concorrentes
  // da mesma solicitação, ou um código digitado que já pertence a outra
  // cidade.
  const resultado = await prisma
    .$transaction(async (tx) => {
      const atualizacao = await tx.solicitacaoCidade.updateMany({
        where: { id: solicitacaoId, status: "PENDENTE" },
        data: { status: "APROVADA", analisadoPorId: session.user.id, analisadoEm: agora },
      });
      if (atualizacao.count === 0) {
        return { ok: false as const };
      }

      await tx.cidade.create({
        data: {
          nome: solicitacao.nomeCidade,
          slug: `${slugificar(solicitacao.nomeCidade)}-${solicitacao.uf.toLowerCase()}`,
          codigoIbge: validado.data.codigoIbge,
          estadoId: estado.id,
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

  await enviarEmailCidadeAprovada({
    email: solicitacao.email,
    nomeCidade: solicitacao.nomeCidade,
    locale: idiomaOuPadrao(solicitacao.idioma),
  });

  revalidatePath("/solicitacoes-cidade");
}

export async function rejeitarSolicitacaoCidade(solicitacaoId: string, formData: FormData) {
  const session = await exigirAdmin();

  const validado = criarRejeitarSolicitacaoCidadeSchema(await getTranslations("Moderacao")).safeParse(
    { motivo: formData.get("motivo") }
  );
  if (!validado.success) {
    return;
  }

  const solicitacao = await prisma.solicitacaoCidade.findUnique({ where: { id: solicitacaoId } });
  if (!solicitacao || solicitacao.status !== "PENDENTE") {
    return;
  }

  // updateMany com status:PENDENTE na condição - mesma guarda atômica de
  // aprovarSolicitacaoCidade() (ver comentário lá).
  const atualizacao = await prisma.solicitacaoCidade.updateMany({
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

  await enviarEmailSolicitacaoCidadeRejeitada({
    email: solicitacao.email,
    motivo: validado.data.motivo,
    locale: idiomaOuPadrao(solicitacao.idioma),
  });

  revalidatePath("/solicitacoes-cidade");
}
