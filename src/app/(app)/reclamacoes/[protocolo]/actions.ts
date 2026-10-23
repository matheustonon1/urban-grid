"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { falha, informacao, sucesso, type ResultadoAcao } from "@/lib/acoes/resultado";
import { criarNotificacao } from "@/lib/notificacoes";
import { orgaoAtendeCategoria } from "@/lib/orgaos/orgaoCategoria";
import { precisaVerificarEmail } from "@/lib/conta/verificacao";
import { STATUS_PUBLICOS } from "@/lib/reclamacoes/statusPublicos";
import { exigirSessao } from "@/lib/seguranca/sessao";

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

export async function alternarConfirmacao(
  reclamacaoId: string,
  protocolo: string
): Promise<ResultadoAcao> {
  const session = await exigirSessao();
  const t = await getTranslations("ReclamacaoDetalhe");

  const [usuario, reclamacao] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.reclamacao.findUnique({ where: { id: reclamacaoId } }),
  ]);

  if (
    !reclamacao ||
    reclamacao.autorId === session.user.id ||
    !(STATUS_PUBLICOS as readonly string[]).includes(reclamacao.status)
  ) {
    return falha(t("erroConfirmar"));
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

  return sucesso(t(existente ? "confirmacaoRemovida" : "confirmou"));
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
        texto: {
          chave: "atividadeSuspeita",
          params: { confirmacoes: confirmacoesRecentes, minutos: JANELA_RAJADA_MINUTOS },
        },
        reclamacaoId,
      })
    )
  );
}

// Compartilhado por criarDenuncia (reclamação) e criarDenunciaComentario -
// a regra de "só uma denúncia aberta por alvo" e o limite diário não
// dependem do tipo de alvo, então ficam num só lugar em vez de duas
// cópias que podiam divergir silenciosamente.
async function motivoParaNaoDenunciar(
  denuncianteId: string,
  alvoTipo: "RECLAMACAO" | "COMENTARIO",
  alvoId: string
): Promise<"duplicada" | "limite" | null> {
  const denunciaAberta = await prisma.denuncia.findFirst({
    where: { denuncianteId, alvoTipo, alvoId, status: "ABERTA" },
  });
  if (denunciaAberta) {
    return "duplicada";
  }

  const inicioDoDia = new Date();
  inicioDoDia.setHours(0, 0, 0, 0);
  const denunciasHoje = await prisma.denuncia.count({
    where: { denuncianteId, createdAt: { gte: inicioDoDia } },
  });
  return denunciasHoje < LIMITE_DENUNCIAS_DIA ? null : "limite";
}

export async function criarDenuncia(
  reclamacaoId: string,
  protocolo: string,
  formData: FormData
): Promise<ResultadoAcao> {
  const session = await exigirSessao();
  const t = await getTranslations("ReclamacaoDetalhe");

  const validado = criarDenunciaSchema(t).safeParse({
    motivo: formData.get("motivo"),
    descricao: formData.get("descricao"),
    declaracaoVeracidade: formData.get("declaracaoVeracidade"),
  });
  if (!validado.success) {
    return falha(validado.error.issues[0]?.message ?? t("erroDenunciaMotivo"));
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
    return falha(t("erroDenunciaIndisponivel"));
  }
  if (usuario && precisaVerificarEmail(usuario)) {
    redirect(`/reclamacoes/${protocolo}?erro=email-nao-verificado`);
  }

  const impedimento = await motivoParaNaoDenunciar(session.user.id, "RECLAMACAO", reclamacaoId);
  if (impedimento) {
    return impedimento === "duplicada"
      ? informacao(t("erroDenunciaDuplicada"))
      : falha(t("erroDenunciaLimite"));
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

  return sucesso(t("denunciaEnviada"));
}

// Mesmo formulário/motivos de criarDenuncia, mas mirando um Comentario em
// vez da Reclamacao inteira - antes desta função, TipoAlvo.COMENTARIO
// existia no schema mas nada no app nunca criava uma Denuncia com esse
// valor (só dava pra denunciar a reclamação como um todo).
export async function criarDenunciaComentario(
  comentarioId: string,
  protocolo: string,
  formData: FormData
): Promise<ResultadoAcao> {
  const session = await exigirSessao();
  const t = await getTranslations("ReclamacaoDetalhe");

  const validado = criarDenunciaSchema(t).safeParse({
    motivo: formData.get("motivo"),
    descricao: formData.get("descricao"),
    declaracaoVeracidade: formData.get("declaracaoVeracidade"),
  });
  if (!validado.success) {
    return falha(validado.error.issues[0]?.message ?? t("erroDenunciaMotivo"));
  }

  const [usuario, comentario] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.comentario.findUnique({ where: { id: comentarioId } }),
  ]);

  if (
    !comentario ||
    comentario.autorId === session.user.id ||
    comentario.statusModeracao !== "APROVADO"
  ) {
    return falha(t("erroDenunciaIndisponivel"));
  }
  if (usuario && precisaVerificarEmail(usuario)) {
    redirect(`/reclamacoes/${protocolo}?erro=email-nao-verificado`);
  }

  const impedimento = await motivoParaNaoDenunciar(session.user.id, "COMENTARIO", comentarioId);
  if (impedimento) {
    return impedimento === "duplicada"
      ? informacao(t("erroDenunciaDuplicada"))
      : falha(t("erroDenunciaLimite"));
  }

  await prisma.denuncia.create({
    data: {
      alvoTipo: "COMENTARIO",
      alvoId: comentarioId,
      denuncianteId: session.user.id,
      motivo: validado.data.motivo,
      descricao: validado.data.descricao,
    },
  });

  revalidatePath(`/reclamacoes/${protocolo}`);

  return sucesso(t("denunciaEnviada"));
}

export async function responderReclamacao(
  reclamacaoId: string,
  protocolo: string,
  formData: FormData
): Promise<ResultadoAcao> {
  const session = await exigirOrgao();
  const t = await getTranslations("ReclamacaoDetalhe");

  const validado = criarRespostaOficialSchema(t).safeParse({
    texto: formData.get("texto"),
    novoStatus: formData.get("novoStatus"),
    prazoEstimado: formData.get("prazoEstimado"),
  });
  if (!validado.success) {
    return falha(validado.error.issues[0]?.message ?? t("erroRespostaCurta"));
  }

  const [orgao, reclamacao] = await Promise.all([
    prisma.orgao.findUnique({
      where: { id: session.user.orgaoId! },
      include: { categorias: { select: { id: true } } },
    }),
    prisma.reclamacao.findUnique({ where: { id: reclamacaoId } }),
  ]);

  if (!reclamacao) {
    return falha(t("erroSemMaisRespostas"));
  }
  if (!orgao?.ativo) {
    return falha(t("erroOrgaoInativo"));
  }
  if (
    orgao.cidadeId !== reclamacao.cidadeId ||
    !orgaoAtendeCategoria(orgao.categorias, reclamacao.categoriaId)
  ) {
    return falha(t("erroOrgaoForaDoEscopo"));
  }
  if (reclamacao.status !== "PUBLICADA" && reclamacao.status !== "EM_ANDAMENTO") {
    return informacao(t("erroSemMaisRespostas"));
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
    // O texto da resposta é do órgão e vai como foi escrito; só o título é traduzido.
    texto: {
      chave: "respostaOficial",
      params: { orgao: orgao.nome },
      mensagemBruta: validado.data.texto,
    },
    reclamacaoId: reclamacao.id,
    protocolo,
  });

  if (validado.data.novoStatus === "RESOLVIDA") {
    await criarNotificacao({
      userId: reclamacao.autorId,
      tipo: "PEDIDO_AVALIACAO",
      texto: {
        chave: "pedidoAvaliacao",
        params: { orgao: orgao.nome, titulo: reclamacao.titulo },
      },
      reclamacaoId: reclamacao.id,
      protocolo,
    });
  }

  revalidatePath(`/reclamacoes/${protocolo}`);
  revalidatePath("/reclamacoes");

  return sucesso(
    t(validado.data.novoStatus === "RESOLVIDA" ? "respostaEnviadaResolvida" : "respostaEnviada")
  );
}

export async function avaliarReclamacao(
  reclamacaoId: string,
  protocolo: string,
  formData: FormData
): Promise<ResultadoAcao> {
  const session = await exigirSessao();
  const t = await getTranslations("ReclamacaoDetalhe");

  const validado = criarAvaliacaoSchema().safeParse({
    nota: formData.get("nota"),
    resolvido: formData.get("resolvido"),
    comentario: formData.get("comentario"),
  });
  if (!validado.success) {
    return falha(t("erroAvaliacaoInvalida"));
  }

  const reclamacao = await prisma.reclamacao.findUnique({
    where: { id: reclamacaoId },
  });
  if (!reclamacao || reclamacao.autorId !== session.user.id || reclamacao.status !== "RESOLVIDA") {
    return falha(t("erroAvaliacaoIndisponivel"));
  }

  const existente = await prisma.avaliacao.findUnique({
    where: { reclamacaoId },
  });
  if (existente) {
    return informacao(t("avaliacaoJaEnviada"));
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

  return sucesso(t("avaliacaoEnviada"));
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
): Promise<ResultadoAcao> {
  const session = await exigirSessao();
  const t = await getTranslations("ReclamacaoDetalhe");

  const validado = criarRecursoSchema(t).safeParse({
    texto: formData.get("texto"),
  });
  if (!validado.success) {
    return falha(validado.error.issues[0]?.message ?? t("erroRecursoCurto"));
  }

  const reclamacao = await prisma.reclamacao.findUnique({
    where: { id: reclamacaoId },
  });
  if (
    !reclamacao ||
    reclamacao.autorId !== session.user.id ||
    reclamacao.status !== "REJEITADA" ||
    reclamacao.emRecurso
  ) {
    return falha(t("erroRecursoIndisponivel"));
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

  return sucesso(t("recursoEnviado"));
}
