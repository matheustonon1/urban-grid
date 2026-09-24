"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { criarNotificacao } from "@/lib/notificacoes";
import { orgaoAtendeCategoria } from "@/lib/orgaoCategoria";
import { precisaVerificarEmail } from "@/lib/verificacao";

import {
  criarAvaliacaoSchema,
  criarDenunciaSchema,
  criarRecursoSchema,
  criarRespostaOficialSchema,
} from "./definitions";
import { exigirOrgao } from "./exigir-orgao";

const LIMITE_DENUNCIAS_DIA = 10;
const JANELA_RAJADA_MINUTOS = 30;
const LIMITE_CONFIRMACOES_RAJADA = 15;

const STATUS_PUBLICOS = [
  "PUBLICADA",
  "EM_ANDAMENTO",
  "RESOLVIDA",
  "ARQUIVADA",
] as const;

export async function alternarConfirmacao(
  reclamacaoId: string,
  protocolo: string
) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const [usuario, reclamacao] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.reclamacao.findUnique({ where: { id: reclamacaoId } }),
  ]);

  if (
    !reclamacao ||
    reclamacao.autorId === session.user.id ||
    !(STATUS_PUBLICOS as readonly string[]).includes(reclamacao.status)
  ) {
    return;
  }
  if (usuario && precisaVerificarEmail(usuario)) {
    redirect(`/reclamacoes/${protocolo}?erro=email-nao-verificado`);
  }

  const chave = {
    userId_reclamacaoId: {
      userId: session.user.id,
      reclamacaoId,
    },
  };

  const existente = await prisma.confirmacao.findUnique({ where: chave });

  if (existente) {
    await prisma.confirmacao.delete({ where: chave });
  } else {
    await prisma.confirmacao.create({
      data: { userId: session.user.id, reclamacaoId },
    });
    await alertarSeRajadaSuspeita(reclamacaoId);
  }

  revalidatePath(`/reclamacoes/${protocolo}`);
}

async function alertarSeRajadaSuspeita(reclamacaoId: string) {
  const desde = new Date(Date.now() - JANELA_RAJADA_MINUTOS * 60 * 1000);
  const confirmacoesRecentes = await prisma.confirmacao.count({
    where: { reclamacaoId, createdAt: { gte: desde } },
  });
  if (confirmacoesRecentes < LIMITE_CONFIRMACOES_RAJADA) {
    return;
  }

  const jaAlertado = await prisma.notificacao.findFirst({
    where: { reclamacaoId, tipo: "ATIVIDADE_SUSPEITA" },
  });
  if (jaAlertado) {
    return;
  }

  const moderadores = await prisma.user.findMany({
    where: { papel: { in: ["MODERADOR", "ADMIN"] } },
    select: { id: true },
  });

  await Promise.all(
    moderadores.map((moderador) =>
      criarNotificacao({
        userId: moderador.id,
        tipo: "ATIVIDADE_SUSPEITA",
        titulo: "Atividade suspeita em confirmações",
        mensagem: `Uma reclamação recebeu ${confirmacoesRecentes} confirmações em ${JANELA_RAJADA_MINUTOS} minutos — pode ser articulação coordenada. Revise manualmente.`,
        reclamacaoId,
      })
    )
  );
}

export async function criarDenuncia(
  reclamacaoId: string,
  protocolo: string,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const validado = criarDenunciaSchema(await getTranslations("ReclamacaoDetalhe")).safeParse({
    motivo: formData.get("motivo"),
    descricao: formData.get("descricao"),
    declaracaoVeracidade: formData.get("declaracaoVeracidade"),
  });
  if (!validado.success) {
    return;
  }

  const [usuario, reclamacao] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.reclamacao.findUnique({ where: { id: reclamacaoId } }),
  ]);

  if (
    !reclamacao ||
    reclamacao.autorId === session.user.id ||
    !(STATUS_PUBLICOS as readonly string[]).includes(reclamacao.status)
  ) {
    return;
  }
  if (usuario && precisaVerificarEmail(usuario)) {
    redirect(`/reclamacoes/${protocolo}?erro=email-nao-verificado`);
  }

  const denunciaAberta = await prisma.denuncia.findFirst({
    where: {
      denuncianteId: session.user.id,
      alvoTipo: "RECLAMACAO",
      alvoId: reclamacaoId,
      status: "ABERTA",
    },
  });
  if (denunciaAberta) {
    return;
  }

  const inicioDoDia = new Date();
  inicioDoDia.setHours(0, 0, 0, 0);
  const denunciasHoje = await prisma.denuncia.count({
    where: { denuncianteId: session.user.id, createdAt: { gte: inicioDoDia } },
  });
  if (denunciasHoje >= LIMITE_DENUNCIAS_DIA) {
    return;
  }

  await prisma.denuncia.create({
    data: {
      alvoTipo: "RECLAMACAO",
      alvoId: reclamacaoId,
      denuncianteId: session.user.id,
      motivo: validado.data.motivo,
      descricao: validado.data.descricao,
    },
  });

  revalidatePath(`/reclamacoes/${protocolo}`);
}

export async function responderReclamacao(
  reclamacaoId: string,
  protocolo: string,
  formData: FormData
) {
  const session = await exigirOrgao();

  const validado = criarRespostaOficialSchema(
    await getTranslations("ReclamacaoDetalhe")
  ).safeParse({
    texto: formData.get("texto"),
    novoStatus: formData.get("novoStatus"),
    prazoEstimado: formData.get("prazoEstimado"),
  });
  if (!validado.success) {
    return;
  }

  const [orgao, reclamacao] = await Promise.all([
    prisma.orgao.findUnique({
      where: { id: session.user.orgaoId! },
      include: { categorias: { select: { id: true } } },
    }),
    prisma.reclamacao.findUnique({ where: { id: reclamacaoId } }),
  ]);

  if (!orgao?.ativo || !reclamacao) {
    return;
  }
  if (orgao.cidadeId !== reclamacao.cidadeId) {
    return;
  }
  if (!orgaoAtendeCategoria(orgao.categorias, reclamacao.categoriaId)) {
    return;
  }
  if (reclamacao.status !== "PUBLICADA" && reclamacao.status !== "EM_ANDAMENTO") {
    return;
  }

  const agora = new Date();

  await prisma.$transaction([
    prisma.respostaOficial.create({
      data: {
        reclamacaoId,
        autorId: session.user.id,
        orgaoId: orgao.id,
        texto: validado.data.texto,
        novoStatus: validado.data.novoStatus,
        prazoEstimado: validado.data.prazoEstimado
          ? new Date(validado.data.prazoEstimado)
          : undefined,
      },
    }),
    ...(validado.data.novoStatus
      ? [
          prisma.reclamacao.update({
            where: { id: reclamacaoId },
            data: {
              status: validado.data.novoStatus,
              ...(validado.data.novoStatus === "RESOLVIDA"
                ? { resolvidaEm: agora }
                : {}),
            },
          }),
        ]
      : []),
  ]);

  await criarNotificacao({
    userId: reclamacao.autorId,
    tipo: "RESPOSTA_OFICIAL",
    titulo: `${orgao.nome} respondeu sua reclamação`,
    mensagem: validado.data.texto,
    reclamacaoId: reclamacao.id,
    protocolo,
  });

  if (validado.data.novoStatus === "RESOLVIDA") {
    await criarNotificacao({
      userId: reclamacao.autorId,
      tipo: "PEDIDO_AVALIACAO",
      titulo: "O problema foi resolvido?",
      mensagem: `${orgao.nome} marcou "${reclamacao.titulo}" como resolvida. Avalie se o problema foi realmente resolvido.`,
      reclamacaoId: reclamacao.id,
      protocolo,
    });
  }

  revalidatePath(`/reclamacoes/${protocolo}`);
  revalidatePath("/reclamacoes");
}

export async function avaliarReclamacao(
  reclamacaoId: string,
  protocolo: string,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const validado = criarAvaliacaoSchema().safeParse({
    nota: formData.get("nota"),
    resolvido: formData.get("resolvido"),
    comentario: formData.get("comentario"),
  });
  if (!validado.success) {
    return;
  }

  const reclamacao = await prisma.reclamacao.findUnique({
    where: { id: reclamacaoId },
  });
  if (!reclamacao || reclamacao.autorId !== session.user.id) {
    return;
  }
  if (reclamacao.status !== "RESOLVIDA") {
    return;
  }

  const existente = await prisma.avaliacao.findUnique({
    where: { reclamacaoId },
  });
  if (existente) {
    return;
  }

  await prisma.avaliacao.create({
    data: {
      reclamacaoId,
      autorId: session.user.id,
      nota: validado.data.nota,
      resolvido: validado.data.resolvido,
      comentario: validado.data.comentario,
    },
  });

  revalidatePath(`/reclamacoes/${protocolo}`);
}

// Único recurso permitido por reclamação rejeitada (emRecurso vira true
// aqui e nunca volta a false) - reaproveita a mesma fila e as mesmas
// ações (aprovarReclamacao/rejeitarReclamacao) que a IA já usa pra
// encaminhar pra revisão humana, só que iniciada pelo autor em vez da
// IA. motivoRejeicao original não é apagado, pra o moderador ver os
// dois lados (por que foi rejeitada e por que o autor discorda).
export async function contestarRejeicao(
  reclamacaoId: string,
  protocolo: string,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const validado = criarRecursoSchema(await getTranslations("ReclamacaoDetalhe")).safeParse({
    texto: formData.get("texto"),
  });
  if (!validado.success) {
    return;
  }

  const reclamacao = await prisma.reclamacao.findUnique({
    where: { id: reclamacaoId },
  });
  if (!reclamacao || reclamacao.autorId !== session.user.id) {
    return;
  }
  if (reclamacao.status !== "REJEITADA" || reclamacao.emRecurso) {
    return;
  }

  await prisma.reclamacao.update({
    where: { id: reclamacaoId },
    data: {
      status: "AGUARDANDO_REVISAO",
      emRecurso: true,
      textoRecurso: validado.data.texto,
    },
  });

  revalidatePath(`/reclamacoes/${protocolo}`);
  revalidatePath("/moderacao");
}
