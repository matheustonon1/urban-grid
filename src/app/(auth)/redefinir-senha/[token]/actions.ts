"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { signIn } from "@/auth";
import { emailDoTokenRedefinicao } from "@/lib/email";
import { alertarSenhaAlterada } from "@/lib/notificacoes";

import { criarRedefinirSenhaSchema, type RedefinirSenhaFormState } from "./definitions";

export async function redefinirSenha(
  token: string,
  _state: RedefinirSenhaFormState,
  formData: FormData
): Promise<RedefinirSenhaFormState> {
  const t = await getTranslations("RedefinirSenha");
  const validado = criarRedefinirSenhaSchema(await getTranslations("Cadastro")).safeParse({
    senha: formData.get("senha"),
    confirmarSenha: formData.get("confirmarSenha"),
  });
  if (!validado.success) {
    return { erros: validado.error.flatten().fieldErrors };
  }

  const registro = await prisma.verificationToken.findUnique({ where: { token } });
  if (!registro || registro.expires <= new Date()) {
    return { mensagem: t("erroLinkExpirado") };
  }

  const email = emailDoTokenRedefinicao(registro.identifier);
  if (!email) {
    return { mensagem: t("erroLinkInvalido") };
  }

  const usuario = await prisma.user.findUnique({ where: { email } });
  if (!usuario?.senhaHash) {
    return { mensagem: t("erroLinkUsado") };
  }

  const senhaHash = await bcrypt.hash(validado.data.senha, 10);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: usuario.id },
      data: {
        senhaHash,
        // senhaAlteradaEm invalida qualquer sessão JWT emitida antes desta
        // troca (ver callback jwt em auth.ts) - se a conta foi comprometida,
        // trocar a senha agora também derruba quem estava com acesso.
        senhaAlteradaEm: new Date(),
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

  await alertarSenhaAlterada(usuario.id);

  try {
    await signIn("credentials", {
      identificador: usuario.email,
      senha: validado.data.senha,
      redirectTo: "/painel",
    });
  } catch (erro) {
    if (erro instanceof AuthError) {
      return { mensagem: t("senhaRedefinida") };
    }
    throw erro;
  }
}
