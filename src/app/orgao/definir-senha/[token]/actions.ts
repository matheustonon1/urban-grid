"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { signIn } from "@/auth";
import { atencao, falha, sucesso, type ResultadoAcao } from "@/lib/acoes/resultado";
import { criarTokenVerificacao, enviarEmailAcessoOrgao } from "@/lib/email";
import { excedeuLimiteCompartilhado } from "@/lib/seguranca/limiteCompartilhado";
import { idiomaOuPadrao } from "@/i18n/config";

import { criarDefinirSenhaSchema, type DefinirSenhaFormState } from "./definitions";

const LIMITE_NOVOS_LINKS_POR_HORA = 3;

// Convite vencido (vale 24 h): quem tem o link velho em mãos pede um novo, que vai para o
// e-mail do próprio convite - nunca para um endereço digitado. Por isso não revela se um
// e-mail tem conta (não pergunta e-mail nenhum) e não adianta a quem só tem o token de
// outra finalidade: o identificador precisa ser o e-mail de uma conta de órgão ainda sem
// senha. Antes, o único caminho era o admin reenviar - e o convidado nem sabia a quem pedir.
export async function reenviarConviteExpirado(token: string): Promise<ResultadoAcao> {
  const t = await getTranslations("DefinirSenhaOrgao");

  const registro = await prisma.verificationToken.findUnique({ where: { token } });
  const usuario = registro
    ? await prisma.user.findUnique({
        where: { email: registro.identifier },
        include: { orgao: true },
      })
    : null;
  if (!usuario || usuario.papel !== "ORGAO" || usuario.senhaHash || !usuario.orgao?.ativo) {
    return falha(t("novoLinkIndisponivel"));
  }

  // Depois das checagens baratas: só conta pedido que de fato mandaria e-mail.
  if (await excedeuLimiteCompartilhado("convite-orgao-reenvio", token, LIMITE_NOVOS_LINKS_POR_HORA, 60 * 60 * 1000)) {
    return falha(t("novoLinkLimite"));
  }

  // criarTokenVerificacao apaga o token antigo: não ficam dois links válidos ao mesmo tempo.
  const novoToken = await criarTokenVerificacao(usuario.email);
  const envio = await enviarEmailAcessoOrgao({
    email: usuario.email,
    token: novoToken,
    nomeOrgao: usuario.orgao.nome,
    locale: idiomaOuPadrao(usuario.idioma),
  });

  if (envio.status === "falhou") {
    return atencao(t("novoLinkFalhou", { motivo: envio.motivo }));
  }
  if (envio.status === "simulado") {
    return atencao(t("novoLinkSimulado"));
  }
  return sucesso(t("novoLinkEnviado"));
}

export async function definirSenhaOrgao(
  token: string,
  _state: DefinirSenhaFormState,
  formData: FormData
): Promise<DefinirSenhaFormState> {
  const t = await getTranslations("DefinirSenhaOrgao");
  const validado = criarDefinirSenhaSchema(await getTranslations("Cadastro")).safeParse({
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

  const usuario = await prisma.user.findUnique({ where: { email: registro.identifier } });
  if (!usuario || usuario.papel !== "ORGAO" || usuario.senhaHash) {
    return { mensagem: t("erroLinkUsado") };
  }

  const senhaHash = await bcrypt.hash(validado.data.senha, 10);

  // Diferente do token de verificação de e-mail, este é de uso único de
  // verdade (define a senha inicial) - apagar impede reaproveitar o
  // mesmo link depois.
  await prisma.$transaction([
    prisma.user.update({ where: { id: usuario.id }, data: { senhaHash } }),
    prisma.verificationToken.delete({ where: { token } }),
  ]);

  try {
    await signIn("credentials", {
      identificador: usuario.email,
      senha: validado.data.senha,
      redirectTo: "/orgao",
    });
  } catch (erro) {
    if (erro instanceof AuthError) {
      return { mensagem: t("senhaDefinida") };
    }
    throw erro;
  }
}
