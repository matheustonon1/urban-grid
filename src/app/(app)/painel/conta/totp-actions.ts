"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { verificarSenhaAtual } from "@/lib/senhaAtual";
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
  criarSenhaAtualSchema,
  type ConfirmarTotpFormState,
  type RegenerarCodigosFormState,
  type SenhaAtualFormState,
} from "./definitions";

export async function iniciarConfiguracaoTotp() {
  const session = await exigirSessao();

  // Só grava se não há 2FA ativo E nenhum segredo pendente - um único
  // updateMany guardado, não "lê e depois atualiza". Antes, um duplo clique
  // (ou uma segunda aba) trocava o segredo por baixo de um QR já escaneado,
  // e uma confirmação concorrente podia ter o segredo ATIVO sobrescrito,
  // deixando a pessoa trancada com um segredo que ela não conhece. Pra
  // gerar um novo segredo, a pessoa cancela a configuração antes.
  await prisma.user.updateMany({
    where: { id: session.user.id, totpConfirmadoEm: null, totpSecret: null },
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
  _state: SenhaAtualFormState,
  formData: FormData
): Promise<SenhaAtualFormState> {
  const session = await exigirSessao();

  const t = await getTranslations("Totp");
  // O schema é compartilhado com excluirConta e pede as chaves de "Conta".
  const validado = criarSenhaAtualSchema(await getTranslations("Conta")).safeParse({
    senhaAtual: formData.get("senhaAtual"),
  });
  if (!validado.success) {
    return { erros: validado.error.flatten().fieldErrors };
  }

  const resultadoSenha = await verificarSenhaAtual(session.user.id, validado.data.senhaAtual);
  if (resultadoSenha === "bloqueada") {
    return { mensagem: t("erroMuitasTentativas") };
  }
  if (resultadoSenha === "incorreta") {
    return { erros: { senhaAtual: [t("erroSenhaIncorreta")] } };
  }
  if (resultadoSenha !== "ok") {
    return { mensagem: t("erroDesativar") };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.user.id },
      data: {
        totpSecret: null,
        totpConfirmadoEm: null,
        totpTentativasFalhas: 0,
        totpBloqueadoAte: null,
      },
    }),
    prisma.totpBackupCode.deleteMany({ where: { userId: session.user.id } }),
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
  const validado = criarSenhaAtualSchema(await getTranslations("Conta")).safeParse({
    senhaAtual: formData.get("senhaAtual"),
  });
  if (!validado.success) {
    return { erros: validado.error.flatten().fieldErrors };
  }

  const resultadoSenha = await verificarSenhaAtual(session.user.id, validado.data.senhaAtual);
  if (resultadoSenha === "bloqueada") {
    return { mensagem: t("erroMuitasTentativas") };
  }
  if (resultadoSenha === "incorreta") {
    return { erros: { senhaAtual: [t("erroSenhaIncorreta")] } };
  }
  const usuario = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, totpConfirmadoEm: true },
  });
  if (resultadoSenha !== "ok" || !usuario?.totpConfirmadoEm) {
    return { mensagem: t("erroGerarCodigos") };
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
