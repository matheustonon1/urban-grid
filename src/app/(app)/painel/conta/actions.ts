"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";

import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { alertarSenhaAlterada } from "@/lib/notificacoes";

import {
  ExclusaoSchema,
  PerfilSchema,
  SenhaSchema,
  type ExclusaoFormState,
  type PerfilFormState,
  type SenhaFormState,
} from "./definitions";

export async function atualizarPerfil(
  _state: PerfilFormState,
  formData: FormData
): Promise<PerfilFormState> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const validado = PerfilSchema.safeParse({
    nome: formData.get("nome"),
    telefone: formData.get("telefone"),
  });
  if (!validado.success) {
    return { erros: validado.error.flatten().fieldErrors };
  }

  const { nome, telefone } = validado.data;

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: nome, telefone: telefone || null },
  });

  revalidatePath("/painel/conta");
  revalidatePath("/painel");

  return { mensagem: "Dados atualizados." };
}

export async function alterarSenha(
  _state: SenhaFormState,
  formData: FormData
): Promise<SenhaFormState> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const validado = SenhaSchema.safeParse({
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
    return { mensagem: "Não foi possível alterar a senha." };
  }

  const senhaAtualValida = await bcrypt.compare(
    validado.data.senhaAtual,
    usuario.senhaHash
  );
  if (!senhaAtualValida) {
    return { erros: { senhaAtual: ["Senha atual incorreta."] } };
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
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const validado = ExclusaoSchema.safeParse({
    senhaAtual: formData.get("senhaAtual"),
  });
  if (!validado.success) {
    return { erros: validado.error.flatten().fieldErrors };
  }

  const usuario = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!usuario?.senhaHash) {
    return { mensagem: "Não foi possível excluir a conta." };
  }

  const senhaValida = await bcrypt.compare(validado.data.senhaAtual, usuario.senhaHash);
  if (!senhaValida) {
    return { erros: { senhaAtual: ["Senha incorreta."] } };
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
