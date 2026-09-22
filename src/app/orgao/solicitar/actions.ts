"use server";

import { headers } from "next/headers";

import { prisma } from "@/lib/prisma";

import { SolicitarOrgaoSchema, type SolicitarOrgaoFormState } from "./definitions";

const LIMITE_SOLICITACOES_POR_IP_HORA = 3;

export async function solicitarOrgao(
  _state: SolicitarOrgaoFormState,
  formData: FormData
): Promise<SolicitarOrgaoFormState> {
  const validado = SolicitarOrgaoSchema.safeParse({
    nomeOrgao: formData.get("nomeOrgao"),
    sigla: formData.get("sigla"),
    cidadeId: formData.get("cidadeId"),
    nomeResponsavel: formData.get("nomeResponsavel"),
    email: formData.get("email"),
    telefone: formData.get("telefone"),
    aceitaTermos: formData.get("aceitaTermos"),
  });
  if (!validado.success) {
    return { erros: validado.error.flatten().fieldErrors };
  }

  const { nomeOrgao, sigla, cidadeId, nomeResponsavel, email, telefone } = validado.data;

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  if (ip) {
    const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000);
    const solicitacoesRecentes = await prisma.solicitacaoOrgao.count({
      where: { criadoDeIp: ip, createdAt: { gte: umaHoraAtras } },
    });
    if (solicitacoesRecentes >= LIMITE_SOLICITACOES_POR_IP_HORA) {
      return {
        mensagem: "Muitas solicitações a partir deste endereço recentemente. Tente novamente mais tarde.",
      };
    }
  }

  const cidade = await prisma.cidade.findUnique({ where: { id: cidadeId } });
  if (!cidade) {
    return { erros: { cidadeId: ["Cidade inválida."] } };
  }

  const usuarioExistente = await prisma.user.findUnique({ where: { email } });
  if (usuarioExistente) {
    return { erros: { email: ["Já existe uma conta com este e-mail."] } };
  }

  const solicitacaoPendente = await prisma.solicitacaoOrgao.findFirst({
    where: { email, status: "PENDENTE" },
  });
  if (solicitacaoPendente) {
    return {
      mensagem: "Já existe uma solicitação pendente com este e-mail. Aguarde a análise.",
    };
  }

  await prisma.solicitacaoOrgao.create({
    data: {
      nomeOrgao,
      sigla: sigla || null,
      cidadeId,
      nomeResponsavel,
      email,
      telefone: telefone || null,
      criadoDeIp: ip,
    },
  });

  return {
    sucesso: true,
    mensagem: "Solicitação enviada! Um administrador vai analisar e você recebe um e-mail com o resultado.",
  };
}
