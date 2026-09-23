"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { getTranslations } from "next-intl/server";

import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { alertarSenhaAlterada, alertarTrocaEmailSolicitada } from "@/lib/notificacoes";
import { criarTokenTrocaEmail, enviarEmailConfirmarTrocaEmail } from "@/lib/email";

import {
  criarExclusaoSchema,
  criarPerfilSchema,
  criarSenhaSchema,
  criarTrocaEmailSchema,
  type ExclusaoFormState,
  type PerfilFormState,
  type SenhaFormState,
  type TrocaEmailFormState,
} from "./definitions";

export async function atualizarPerfil(
  _state: PerfilFormState,
  formData: FormData
): Promise<PerfilFormState> {
  const t = await getTranslations("Conta");
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const validado = criarPerfilSchema().safeParse({
    telefone: formData.get("telefone"),
  });
  if (!validado.success) {
    return { erros: validado.error.flatten().fieldErrors };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { telefone: validado.data.telefone || null },
  });

  revalidatePath("/painel/conta");
  revalidatePath("/painel");

  return { mensagem: t("dadosAtualizados") };
}

export async function solicitarTrocaEmail(
  _state: TrocaEmailFormState,
  formData: FormData
): Promise<TrocaEmailFormState> {
  const t = await getTranslations("Conta");
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const validado = criarTrocaEmailSchema(t).safeParse({
    novoEmail: formData.get("novoEmail"),
    senhaAtual: formData.get("senhaAtual"),
  });
  if (!validado.success) {
    return { erros: validado.error.flatten().fieldErrors };
  }

  const { novoEmail, senhaAtual } = validado.data;

  const usuario = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!usuario?.senhaHash) {
    return { mensagem: t("erroTrocarEmail") };
  }

  const senhaValida = await bcrypt.compare(senhaAtual, usuario.senhaHash);
  if (!senhaValida) {
    return { erros: { senhaAtual: [t("erroSenhaIncorreta")] } };
  }

  if (novoEmail === usuario.email) {
    return { erros: { novoEmail: [t("erroJaEEmailAtual")] } };
  }

  const emailEmUso = await prisma.user.findUnique({ where: { email: novoEmail } });
  if (emailEmUso) {
    return { erros: { novoEmail: [t("erroEmailDuplicado")] } };
  }

  const token = await criarTokenTrocaEmail(usuario.id, novoEmail);
  await enviarEmailConfirmarTrocaEmail({ email: novoEmail, token, emailAtual: usuario.email });
  // Aviso pro e-mail atual sai mesmo se falhar o envio acima (enviarEmail
  // nunca lança) - dono da conta precisa saber que uma troca foi pedida,
  // independente do e-mail novo ter recebido o link ou não.
  await alertarTrocaEmailSolicitada(usuario.id, novoEmail);

  return { mensagem: t("linkConfirmacaoEnviado", { email: novoEmail }) };
}

export async function alterarSenha(
  _state: SenhaFormState,
  formData: FormData
): Promise<SenhaFormState> {
  const t = await getTranslations("Conta");
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const validado = criarSenhaSchema(t).safeParse({
    senhaAtual: formData.get("senhaAtual"),
    novaSenha: formData.get("novaSenha"),
    confirmarNovaSenha: formData.get("confirmarNovaSenha"),
  });
  if (!validado.success) {
    return { erros: validado.error.flatten().fieldErrors };
  }

  const usuario = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!usuario?.senhaHash) {
    return { mensagem: t("erroAlterarSenha") };
  }

  const senhaAtualValida = await bcrypt.compare(
    validado.data.senhaAtual,
    usuario.senhaHash
  );
  if (!senhaAtualValida) {
    return { erros: { senhaAtual: [t("erroSenhaAtualIncorreta")] } };
  }

  const novaSenhaHash = await bcrypt.hash(validado.data.novaSenha, 10);
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      senhaHash: novaSenhaHash,
      // Invalida a sessão atual também (não só outras) - ver callback jwt
      // em auth.ts. Evita comportamento assimétrico com a redefinição por
      // e-mail, que também encerra sessões antigas.
      senhaAlteradaEm: new Date(),
    },
  });

  await alertarSenhaAlterada(session.user.id);

  // A própria sessão atual acabou de ser invalidada pela troca acima -
  // encerra explicitamente em vez de deixar a próxima requisição
  // descobrir isso sozinha.
  await signOut({ redirectTo: "/login" });
}

export async function excluirConta(
  _state: ExclusaoFormState,
  formData: FormData
): Promise<ExclusaoFormState> {
  const t = await getTranslations("Conta");
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const validado = criarExclusaoSchema(t).safeParse({
    senhaAtual: formData.get("senhaAtual"),
  });
  if (!validado.success) {
    return { erros: validado.error.flatten().fieldErrors };
  }

  const usuario = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!usuario?.senhaHash) {
    return { mensagem: t("erroExcluirConta") };
  }

  const senhaValida = await bcrypt.compare(validado.data.senhaAtual, usuario.senhaHash);
  if (!senhaValida) {
    return { erros: { senhaAtual: [t("erroSenhaIncorreta")] } };
  }

  // Anonimiza em vez de apagar: preserva as reclamações publicadas como
  // registro de interesse público (sem identificar o autor) e evita
  // violar as FKs que hoje referenciam User a partir de várias tabelas.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: usuario.id },
      data: {
        name: "Usuário removido",
        email: `removido-${usuario.id}@urbangrid.local`,
        senhaHash: null,
        cpfHash: null,
        telefone: null,
        image: null,
        ativo: false,
      },
    }),
    prisma.reclamacao.updateMany({
      where: { autorId: usuario.id },
      data: { anonima: true },
    }),
  ]);

  await signOut({ redirectTo: "/" });
}
