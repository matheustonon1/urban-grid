"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import {
  cifrarSegredoTotp,
  codigoTotpValido,
  decifrarSegredoTotp,
  gerarCodigosBackup,
  gerarSegredoTotp,
  prepararCodigosBackup,
} from "@/lib/totp";
import { exigirSessao } from "@/lib/sessao";

import {
  criarConfirmarTotpSchema,
  criarDesativarTotpSchema,
  criarRegenerarCodigosSchema,
  type ConfirmarTotpFormState,
  type DesativarTotpFormState,
  type RegenerarCodigosFormState,
} from "./definitions";

export async function iniciarConfiguracaoTotp() {
  const session = await exigirSessao();

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
  const session = await exigirSessao();

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
  const session = await exigirSessao();

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
  const resultado = await codigoTotpValido(segredo, validado.data.codigo);
  if (!resultado.valido) {
    return { erros: { codigo: [t("erroCodigoInvalido")] } };
  }

  const codigosBackup = gerarCodigosBackup();
  const dadosCodigosBackup = await prepararCodigosBackup(usuario.id, codigosBackup);

  // As três escritas precisam ser atômicas: se a criação dos códigos de
  // backup falhasse fora dessa transação, uma conta poderia ficar com
  // 2FA ativado e nenhum código de recuperação salvo. totpUltimoTimeStep
  // já sai gravado com o código de confirmação, pra ele não poder ser
  // reaproveitado no primeiro login (ver comentário em codigoTotpValido).
  await prisma.$transaction([
    prisma.user.update({
      where: { id: usuario.id },
      data: { totpConfirmadoEm: new Date(), totpUltimoTimeStep: resultado.timeStep },
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
  const session = await exigirSessao();

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

// Os códigos de backup só são mostrados uma vez (na ativação) e cada um
// vale um único uso - quem gasta ou perde a lista ficaria sem saída caso
// perdesse também o aplicativo autenticador. Gerar um lote novo descarta
// o anterior inteiro (inclusive os ainda não usados), por isso a senha é
// exigida: é o mesmo nível de confirmação de desativarTotp().
export async function regenerarCodigosBackup(
  _state: RegenerarCodigosFormState,
  formData: FormData
): Promise<RegenerarCodigosFormState> {
  const session = await exigirSessao();

  const t = await getTranslations("Totp");
  const validado = criarRegenerarCodigosSchema(t).safeParse({
    senhaAtual: formData.get("senhaAtual"),
  });
  if (!validado.success) {
    return { erros: validado.error.flatten().fieldErrors };
  }

  const usuario = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!usuario?.senhaHash || !usuario.totpConfirmadoEm) {
    return { mensagem: t("erroGerarCodigos") };
  }

  const senhaValida = await bcrypt.compare(validado.data.senhaAtual, usuario.senhaHash);
  if (!senhaValida) {
    return { erros: { senhaAtual: [t("erroSenhaIncorreta")] } };
  }

  const codigosBackup = gerarCodigosBackup();
  const dadosCodigosBackup = await prepararCodigosBackup(usuario.id, codigosBackup);

  // Atômico pelo mesmo motivo de confirmarTotp(): se o createMany falhasse
  // depois do deleteMany, a conta ficaria com 2FA ativo e zero códigos.
  await prisma.$transaction([
    prisma.totpBackupCode.deleteMany({ where: { userId: usuario.id } }),
    prisma.totpBackupCode.createMany({ data: dadosCodigosBackup }),
  ]);

  revalidatePath("/painel/conta");

  return { mensagem: t("novosCodigosGerados"), codigosBackup };
}
