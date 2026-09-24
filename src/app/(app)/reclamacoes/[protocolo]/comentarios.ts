"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { criarNotificacao } from "@/lib/notificacoes";
import { precisaVerificarEmail } from "@/lib/verificacao";
import { moderarComentario } from "@/lib/moderacaoComentario";

import { criarComentarioSchema } from "./definitions";

const LIMITE_COMENTARIOS_DIA = 20;

const STATUS_PUBLICOS = [
  "PUBLICADA",
  "EM_ANDAMENTO",
  "RESOLVIDA",
  "ARQUIVADA",
] as const;

export async function criarComentario(
  reclamacaoId: string,
  protocolo: string,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const validado = criarComentarioSchema(await getTranslations("ReclamacaoDetalhe")).safeParse({
    texto: formData.get("texto"),
    paiId: formData.get("paiId"),
  });
  if (!validado.success) {
    return;
  }

  const [usuario, reclamacao] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.reclamacao.findUnique({ where: { id: reclamacaoId } }),
  ]);

  if (!reclamacao) {
    return;
  }

  // Mesma regra de acesso da página: visível ao público, ou ao autor e a
  // moderadores mesmo antes de publicar - evita que qualquer sessão
  // comente numa reclamação que ainda não pode ver (aguardando revisão,
  // rejeitada, rascunho).
  const ehAutor = reclamacao.autorId === session.user.id;
  const ehModerador = usuario?.papel === "MODERADOR" || usuario?.papel === "ADMIN";
  if (
    !ehAutor &&
    !ehModerador &&
    !(STATUS_PUBLICOS as readonly string[]).includes(reclamacao.status)
  ) {
    return;
  }

  if (usuario && precisaVerificarEmail(usuario)) {
    redirect(`/reclamacoes/${protocolo}?erro=email-nao-verificado`);
  }

  // Só permite responder a um comentário de nível zero (não deixa
  // encadear resposta de resposta) - mantém a interface simples mesmo
  // o schema permitindo aninhamento arbitrário.
  if (validado.data.paiId) {
    const pai = await prisma.comentario.findUnique({
      where: { id: validado.data.paiId },
    });
    if (!pai || pai.reclamacaoId !== reclamacaoId || pai.paiId) {
      return;
    }
  }

  const inicioDoDia = new Date();
  inicioDoDia.setHours(0, 0, 0, 0);
  const comentariosHoje = await prisma.comentario.count({
    where: { autorId: session.user.id, createdAt: { gte: inicioDoDia } },
  });
  if (comentariosHoje >= LIMITE_COMENTARIOS_DIA) {
    return;
  }

  const comentario = await prisma.comentario.create({
    data: {
      reclamacaoId,
      autorId: session.user.id,
      texto: validado.data.texto,
      paiId: validado.data.paiId,
    },
  });

  const decisao = await moderarComentario(comentario.id, validado.data.texto);
  await prisma.comentario.update({
    where: { id: comentario.id },
    data: { statusModeracao: decisao === "APROVAR" ? "APROVADO" : "REPROVADO" },
  });

  if (decisao === "APROVAR") {
    const notificarId = validado.data.paiId
      ? (await prisma.comentario.findUnique({ where: { id: validado.data.paiId } }))
          ?.autorId
      : reclamacao.autorId;

    if (notificarId && notificarId !== session.user.id) {
      await criarNotificacao({
        userId: notificarId,
        tipo: "NOVO_COMENTARIO",
        titulo: validado.data.paiId
          ? "Responderam seu comentário"
          : "Novo comentário na sua reclamação",
        mensagem: validado.data.texto,
        reclamacaoId,
      });
    }
  }

  revalidatePath(`/reclamacoes/${protocolo}`);
}
