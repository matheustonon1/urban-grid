"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { falha, informacao, sucesso, type ResultadoAcao } from "@/lib/acoes/resultado";
import { criarNotificacao } from "@/lib/notificacoes";
import { responsaveisAtivosDosOrgaos } from "@/lib/notificacoes/orgaos";
import { JANELA_CORRECAO_MS, motivoSemCorrecao } from "@/lib/orgaos/correcaoResposta";
import { orgaoAtendeCategoria } from "@/lib/orgaos/orgaoCategoria";
import { precisaVerificarEmail } from "@/lib/conta/verificacao";
import { podeAvaliar } from "@/lib/reclamacoes/avaliacao";
import { STATUS_PUBLICOS } from "@/lib/reclamacoes/statusPublicos";
import { exigirSessao } from "@/lib/seguranca/sessao";

import {
  criarAvaliacaoSchema,
  criarCorrecaoRespostaSchema,
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
  // Conta de órgão não confirma reclamação de cidadão: a tela já esconde o botão, e o
  // servidor recusa mesmo assim (um POST forjado não pode inflar a contagem).
  if (usuario?.papel === "ORGAO") {
    return falha(t("erroConfirmarOrgao"));
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

  // Quem abriu a reclamação e quem responde oficialmente não podem ser a mesma parte: um
  // órgão que se responde, marca resolvida e se avalia infla a própria reputação pública.
  // A conta de órgão já não abre reclamação; isto cobre as que existiam antes dessa regra.
  const autor = await prisma.user.findUnique({
    where: { id: reclamacao.autorId },
    select: { orgaoId: true },
  });
  if (autor?.orgaoId === orgao.id) {
    return falha(t("erroRespostaPropria"));
  }

  const agora = new Date();
  const novoStatus = validado.data.novoStatus;

  // O status foi lido lá em cima, mas pode ter mudado até aqui (outra pessoa do órgão
  // resolveu, o autor contestou, a moderação arquivou): a guarda no WHERE decide, e a
  // resposta só é gravada se a reclamação ainda estava aberta.
  const gravou = await prisma.$transaction(async (tx) => {
    const aberta = await tx.reclamacao.updateMany({
      where: { id: reclamacaoId, status: { in: ["PUBLICADA", "EM_ANDAMENTO"] } },
      data: novoStatus
        ? { status: novoStatus, ...(novoStatus === "RESOLVIDA" ? { resolvidaEm: agora } : {}) }
        : { updatedAt: agora },
    });
    if (aberta.count === 0) {
      return false;
    }

    await tx.respostaOficial.create({
      data: {
        reclamacaoId,
        autorId: session.user.id,
        orgaoId: orgao.id,
        texto: validado.data.texto,
        novoStatus,
        prazoEstimado: validado.data.prazoEstimado
          ? new Date(validado.data.prazoEstimado)
          : undefined,
      },
    });
    return true;
  });
  if (!gravou) {
    return informacao(t("erroSemMaisRespostas"));
  }

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

// Corrige o texto e o prazo de uma resposta oficial recém-enviada (regras e porquê em
// lib/orgaos/correcaoResposta). A tela só mostra o botão quando a regra permite; aqui o
// servidor confere de novo, e a escrita repete a janela e "ainda é a mais recente" dentro da
// transação: uma resposta nova ou o fim da janela entre a leitura e a gravação não passam.
export async function corrigirRespostaOficial(
  respostaId: string,
  protocolo: string,
  formData: FormData
): Promise<ResultadoAcao> {
  const session = await exigirOrgao();
  const t = await getTranslations("ReclamacaoDetalhe");

  const validado = criarCorrecaoRespostaSchema(t).safeParse({
    texto: formData.get("texto"),
    prazoEstimado: formData.get("prazoEstimado"),
  });
  if (!validado.success) {
    return falha(validado.error.issues[0]?.message ?? t("erroRespostaCurta"));
  }

  // Escopo pelo órgão da sessão no próprio WHERE da leitura: a resposta de outro órgão
  // responde igual a uma que não existe, sem confirmar que o id é válido.
  const resposta = await prisma.respostaOficial.findFirst({
    where: { id: respostaId, orgaoId: session.user.orgaoId! },
    include: { reclamacao: { select: { id: true, avaliacao: { select: { createdAt: true } } } } },
  });
  if (!resposta) {
    return falha(t("erroCorrecaoIndisponivel"));
  }

  const orgao = await prisma.orgao.findUnique({
    where: { id: resposta.orgaoId },
    select: { ativo: true },
  });
  if (!orgao?.ativo) {
    return falha(t("erroOrgaoInativo"));
  }

  const agora = new Date();
  const posteriores = await prisma.respostaOficial.count({
    where: { reclamacaoId: resposta.reclamacaoId, createdAt: { gt: resposta.createdAt } },
  });
  const avaliacao = resposta.reclamacao.avaliacao;
  const motivo = motivoSemCorrecao({
    resposta,
    orgaoIdDoUsuario: session.user.orgaoId,
    agora,
    haRespostaPosterior: posteriores > 0,
    avaliadaDepois: !!avaliacao && avaliacao.createdAt > resposta.createdAt,
  });
  if (motivo) {
    return informacao(t(`erroCorrecao.${motivo}`));
  }

  const { texto, prazoEstimado } = validado.data;
  const gravou = await prisma.$transaction(async (tx) => {
    const maisRecente = await tx.respostaOficial.count({
      where: { reclamacaoId: resposta.reclamacaoId, createdAt: { gt: resposta.createdAt } },
    });
    if (maisRecente > 0) return false;

    const atualizada = await tx.respostaOficial.updateMany({
      where: {
        id: respostaId,
        orgaoId: session.user.orgaoId!,
        createdAt: { gte: new Date(agora.getTime() - JANELA_CORRECAO_MS) },
      },
      data: {
        texto,
        prazoEstimado: prazoEstimado ? new Date(prazoEstimado) : null,
        editadaEm: agora,
      },
    });
    return atualizada.count === 1;
  });
  if (!gravou) {
    return informacao(t("erroCorrecaoMudou"));
  }

  revalidatePath(`/reclamacoes/${protocolo}`);
  revalidatePath("/orgao");

  return sucesso(t("correcaoSalva"));
}

export async function avaliarReclamacao(
  reclamacaoId: string,
  protocolo: string,
  formData: FormData
): Promise<ResultadoAcao> {
  const session = await exigirSessao();
  const t = await getTranslations("ReclamacaoDetalhe");

  // O órgão responde; quem avalia é o cidadão. Conta de órgão não avalia (nem a própria
  // resposta: a nota alimenta a reputação pública dele).
  if (session.user.papel === "ORGAO") {
    return falha(t("erroAvaliacaoOrgao"));
  }

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
    include: {
      avaliacao: true,
      respostas: { select: { orgaoId: true } },
    },
  });
  if (!reclamacao || reclamacao.autorId !== session.user.id || reclamacao.status !== "RESOLVIDA") {
    return falha(t("erroAvaliacaoIndisponivel"));
  }
  if (!podeAvaliar(reclamacao, reclamacao.avaliacao)) {
    return informacao(t("avaliacaoJaEnviada"));
  }

  const { nota, resolvido, comentario } = validado.data;
  const anterior = reclamacao.avaliacao;

  // Contestar ("não foi resolvido") REABRE a reclamação: senão ela ficaria resolvida para
  // sempre com o autor discordando e sem o órgão saber nem poder responder. A reabertura e
  // a avaliação valem juntas ou nenhuma vale, e a guarda no WHERE (status ainda RESOLVIDA)
  // impede reabrir o que outra ação acabou de mudar.
  let situacao: "ok" | "jaMudou";
  try {
    situacao = await prisma.$transaction(async (tx) => {
      if (!resolvido) {
        const reaberta = await tx.reclamacao.updateMany({
          where: { id: reclamacaoId, status: "RESOLVIDA" },
          data: { status: "EM_ANDAMENTO", resolvidaEm: null },
        });
        if (reaberta.count === 0) return "jaMudou" as const;
      }

      if (anterior) {
        // Substitui a contestação anterior (só ela pode ser substituída, e só uma vez por
        // resolução: a data da avaliação vigente é a guarda).
        const substituida = await tx.avaliacao.updateMany({
          where: { id: anterior.id, resolvido: false, createdAt: anterior.createdAt },
          data: { nota, resolvido, comentario: comentario ?? null, createdAt: new Date() },
        });
        if (substituida.count === 0) {
          throw new AvaliacaoJaMudou();
        }
      } else {
        await tx.avaliacao.create({
          data: { reclamacaoId, autorId: session.user.id, nota, resolvido, comentario },
        });
      }
      return "ok" as const;
    });
  } catch (erro) {
    // P2002: duas avaliações ao mesmo tempo, a outra venceu (reclamacaoId é único).
    const perdeuACorrida =
      erro instanceof AvaliacaoJaMudou ||
      (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002");
    if (!perdeuACorrida) throw erro;
    situacao = "jaMudou";
  }
  if (situacao === "jaMudou") {
    revalidatePath(`/reclamacoes/${protocolo}`);
    return informacao(t("avaliacaoJaEnviada"));
  }

  if (!resolvido) {
    // O órgão precisa saber agora: a reclamação voltou para a fila dele.
    const orgaoIds = [...new Set(reclamacao.respostas.map((resposta) => resposta.orgaoId))];
    const destinatarios = await responsaveisAtivosDosOrgaos(orgaoIds);
    await Promise.all(
      destinatarios.map((userId) =>
        criarNotificacao({
          userId,
          tipo: "MUDANCA_STATUS",
          texto: comentario
            ? {
                chave: "reclamacaoReabertaComComentario",
                params: { titulo: reclamacao.titulo, comentario },
              }
            : { chave: "reclamacaoReaberta", params: { titulo: reclamacao.titulo } },
          reclamacaoId: reclamacao.id,
          protocolo,
        })
      )
    );
    revalidatePath("/orgao");
    revalidatePath("/reclamacoes");
  }

  revalidatePath(`/reclamacoes/${protocolo}`);

  return sucesso(t(resolvido ? "avaliacaoEnviada" : "avaliacaoEnviadaReaberta"));
}

// Sinaliza, dentro da transação de avaliarReclamacao, que a avaliação que ela ia substituir
// já foi trocada por outra requisição - lançar desfaz também a reabertura.
class AvaliacaoJaMudou extends Error {}

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
