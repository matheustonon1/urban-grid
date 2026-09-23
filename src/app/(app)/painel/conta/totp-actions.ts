"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  cifrarSegredoTotp,
  codigoTotpValido,
  decifrarSegredoTotp,
  gerarCodigosBackup,
  gerarSegredoTotp,
  prepararCodigosBackup,
} from "@/lib/totp";

import {
  criarConfirmarTotpSchema,
  criarDesativarTotpSchema,
  type ConfirmarTotpFormState,
  type DesativarTotpFormState,
} from "./definitions";

export async function iniciarConfiguracaoTotp() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const usuario = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  if (usuario.totpConfirmadoEm) {
    return;
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { totpSecret: cifrarSegredoTotp(gerarSegredoTotp()) },
  });

  revalidatePath("/painel/conta");
}

export async function cancelarConfiguracaoTotp() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  await prisma.user.updateMany({
    where: { id: session.user.id, totpConfirmadoEm: null },
    data: { totpSecret: null },
  });

  revalidatePath("/painel/conta");
}

export async function confirmarTotp(
  _state: ConfirmarTotpFormState,
  formData: FormData
): Promise<ConfirmarTotpFormState> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const t = await getTranslations("Totp");
  const validado = criarConfirmarTotpSchema(t).safeParse({ codigo: formData.get("codigo") });
  if (!validado.success) {
    return { erros: validado.error.flatten().fieldErrors };
  }

  const usuario = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  if (!usuario.totpSecret || usuario.totpConfirmadoEm) {
    return { mensagem: t("erroSemConfiguracaoPendente") };
  }

  const segredo = decifrarSegredoTotp(usuario.totpSecret);
  if (!(await codigoTotpValido(segredo, validado.data.codigo))) {
    return { erros: { codigo: [t("erroCodigoInvalido")] } };
  }

  const codigosBackup = gerarCodigosBackup();
  const dadosCodigosBackup = await prepararCodigosBackup(usuario.id, codigosBackup);

  // As três escritas precisam ser atômicas: se a criação dos códigos de
  // backup falhasse fora dessa transação, uma conta poderia ficar com
  // 2FA ativado e nenhum código de recuperação salvo.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: usuario.id },
      data: { totpConfirmadoEm: new Date() },
    }),
    prisma.totpBackupCode.deleteMany({ where: { userId: usuario.id } }),
    prisma.totpBackupCode.createMany({ data: dadosCodigosBackup }),
  ]);

  revalidatePath("/painel/conta");

  return {
    mensagem: t("ativadaMensagem"),
    codigosBackup,
  };
}

export async function desativarTotp(
  _state: DesativarTotpFormState,
  formData: FormData
): Promise<DesativarTotpFormState> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const t = await getTranslations("Totp");
  const validado = criarDesativarTotpSchema(t).safeParse({
    senhaAtual: formData.get("senhaAtual"),
  });
  if (!validado.success) {
    return { erros: validado.error.flatten().fieldErrors };
  }

  const usuario = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!usuario?.senhaHash) {
    return { mensagem: t("erroDesativar") };
  }

  const senhaValida = await bcrypt.compare(validado.data.senhaAtual, usuario.senhaHash);
  if (!senhaValida) {
    return { erros: { senhaAtual: [t("erroSenhaIncorreta")] } };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: usuario.id },
      data: {
        totpSecret: null,
        totpConfirmadoEm: null,
        totpTentativasFalhas: 0,
        totpBloqueadoAte: null,
      },
    }),
    prisma.totpBackupCode.deleteMany({ where: { userId: usuario.id } }),
  ]);

  revalidatePath("/painel/conta");

  return { mensagem: t("desativadaMensagem") };
}
