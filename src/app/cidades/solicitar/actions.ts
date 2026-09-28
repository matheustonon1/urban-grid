"use server";

import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { obterIdiomaAtual } from "@/i18n/atual";

import { criarSolicitarCidadeSchema, type SolicitarCidadeFormState } from "./definitions";

const LIMITE_SOLICITACOES_POR_IP_HORA = 3;

export async function solicitarCidade(
  _state: SolicitarCidadeFormState,
  formData: FormData
): Promise<SolicitarCidadeFormState> {
  const t = await getTranslations("SolicitarCidade");
  const validado = criarSolicitarCidadeSchema(t).safeParse({
    nomeCidade: formData.get("nomeCidade"),
    uf: formData.get("uf"),
    nomeSolicitante: formData.get("nomeSolicitante"),
    email: formData.get("email"),
  });
  if (!validado.success) {
    return { erros: validado.error.flatten().fieldErrors };
  }

  const { nomeCidade, uf, nomeSolicitante, email } = validado.data;

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  if (ip) {
    const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000);
    const solicitacoesRecentes = await prisma.solicitacaoCidade.count({
      where: { criadoDeIp: ip, createdAt: { gte: umaHoraAtras } },
    });
    if (solicitacoesRecentes >= LIMITE_SOLICITACOES_POR_IP_HORA) {
      return { mensagem: t("erroLimiteSolicitacoes") };
    }
  }

  // Evita pedido redundante pra uma cidade que já está cadastrada - o
  // caso mais comum na prática não é má-fé, é a pessoa não ter encontrado
  // a cidade no autocomplete por causa de acento/grafia diferente.
  const cidadeExistente = await prisma.cidade.findFirst({
    where: { nome: nomeCidade, estado: { uf } },
  });
  if (cidadeExistente) {
    return { mensagem: t("erroCidadeJaExiste") };
  }

  const solicitacaoPendente = await prisma.solicitacaoCidade.findFirst({
    where: { email, status: "PENDENTE" },
  });
  if (solicitacaoPendente) {
    return { mensagem: t("erroSolicitacaoPendente") };
  }

  await prisma.solicitacaoCidade.create({
    data: {
      nomeCidade,
      uf,
      nomeSolicitante,
      email,
      criadoDeIp: ip,
      idioma: await obterIdiomaAtual(),
    },
  });

  return { sucesso: true, mensagem: t("solicitacaoEnviada") };
}
