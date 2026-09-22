"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { signIn } from "@/auth";
import { emailDoTokenRedefinicao } from "@/lib/email";

import { RedefinirSenhaSchema, type RedefinirSenhaFormState } from "./definitions";

export async function redefinirSenha(
  token: string,
  _state: RedefinirSenhaFormState,
  formData: FormData
): Promise<RedefinirSenhaFormState> {
  const validado = RedefinirSenhaSchema.safeParse({
    senha: formData.get("senha"),
    confirmarSenha: formData.get("confirmarSenha"),
  });
  if (!validado.success) {
    return { erros: validado.error.flatten().fieldErrors };
  }

  const registro = await prisma.verificationToken.findUnique({ where: { token } });
  if (!registro || registro.expires <= new Date()) {
    return { mensagem: "Este link expirou. Peça um novo em 'Esqueci minha senha'." };
  }

  const email = emailDoTokenRedefinicao(registro.identifier);
  if (!email) {
    return { mensagem: "Este link não é válido para redefinição de senha." };
  }

  const usuario = await prisma.user.findUnique({ where: { email } });
  if (!usuario?.senhaHash) {
    return { mensagem: "Este link já foi usado ou não é mais válido." };
  }

  const senhaHash = await bcrypt.hash(validado.data.senha, 10);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: usuario.id },
      data: {
        senhaHash,
        // Quem prova controle do e-mail redefinindo a senha já demonstrou
        // ser o dono da conta - não faz sentido continuar bloqueado por
        // tentativas de senha erradas anteriores.
        loginTentativasFalhas: 0,
        loginBloqueadoAte: null,
      },
    }),
    // Token de uso único de verdade (diferente do de verificação de
    // e-mail, que fica idempotente até expirar) - redefinir senha é
    // sensível, então apagar impede reaproveitar o mesmo link depois.
    prisma.verificationToken.delete({ where: { token } }),
  ]);

  try {
    await signIn("credentials", {
      identificador: usuario.email,
      senha: validado.data.senha,
      redirectTo: "/painel",
    });
  } catch (erro) {
    if (erro instanceof AuthError) {
      return { mensagem: "Senha redefinida! Faça login para continuar." };
    }
    throw erro;
  }
}
