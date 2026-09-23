"use server";

import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { criarTokenRedefinicaoSenha, enviarEmailRedefinicaoSenha } from "@/lib/email";
import { excedeuLimitePorIp } from "@/lib/rateLimitMemoria";

import { criarEsqueciSenhaSchema, type EsqueciSenhaFormState } from "./definitions";

const LIMITE_POR_IP_HORA = 5;
const LIMITE_POR_EMAIL_HORA = 3;

export async function solicitarRedefinicaoSenha(
  _state: EsqueciSenhaFormState,
  formData: FormData
): Promise<EsqueciSenhaFormState> {
  const t = await getTranslations("EsqueciSenha");
  const mensagemGenerica = t("mensagemGenerica");
  const validado = criarEsqueciSenhaSchema(await getTranslations("Cadastro")).safeParse({
    email: formData.get("email"),
  });
  if (!validado.success) {
    return { erros: validado.error.flatten().fieldErrors };
  }

  const email = validado.data.email;
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  // Mensagem sempre igual, independente do que aconteceu por baixo - evita
  // que alguém descubra quais e-mails têm conta só testando aqui, mesmo
  // princípio já usado no login (nunca revela se a conta existe).
  if (
    excedeuLimitePorIp("redefinir-senha-ip", ip, LIMITE_POR_IP_HORA, 60 * 60 * 1000) ||
    excedeuLimitePorIp("redefinir-senha-email", email, LIMITE_POR_EMAIL_HORA, 60 * 60 * 1000)
  ) {
    return { mensagem: mensagemGenerica };
  }

  const usuario = await prisma.user.findUnique({ where: { email } });

  // Só envia se a conta existir e já tiver senha - contas de órgão recém
  // aprovadas, sem senha ainda, usam o convite em /orgao/definir-senha,
  // não este fluxo.
  if (usuario?.senhaHash) {
    const token = await criarTokenRedefinicaoSenha(email);
    await enviarEmailRedefinicaoSenha({ email, token });
  }

  return { mensagem: mensagemGenerica };
}
