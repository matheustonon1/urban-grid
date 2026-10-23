"use server";

import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { exigirConfirmacaoDeSenha } from "@/lib/acoes/confirmarSenha";
import { falha, informacao, sucesso, type ResultadoAcao } from "@/lib/acoes/resultado";
import { registrarAuditoria } from "@/lib/auditoria";
import { criarNotificacao } from "@/lib/notificacoes";
import { formatarData } from "@/lib/util/formatarData";

import { exigirModerador } from "../moderacao/exigir-moderador";
import { exigirAdmin } from "../solicitacoes-orgao/exigir-admin";

async function buscarDenunciaAberta(denunciaId: string) {
  return prisma.denuncia.findFirst({
    where: { id: denunciaId, status: "ABERTA" },
  });
}

export async function marcarImprocedente(denunciaId: string): Promise<ResultadoAcao> {
  const session = await exigirModerador();
  const t = await getTranslations("Denuncias");

  // Status ABERTA na condição: se outra pessoa já decidiu esta denúncia entre a
  // página carregar e o clique, count vem 0 e nada é sobrescrito.
  const atualizacao = await prisma.denuncia.updateMany({
    where: { id: denunciaId, status: "ABERTA" },
    data: {
      status: "IMPROCEDENTE",
      analisadoPorId: session.user.id,
      analisadoEm: new Date(),
    },
  });

  revalidatePath("/denuncias");

  return atualizacao.count === 0 ? informacao(t("jaAnalisada")) : sucesso(t("improcedenteOk"));
}

type Denuncia = { id: string; alvoId: string; alvoTipo: string };

// Quem postou o conteúdo denunciado. banirAutor() precisa saber ANTES de decidir
// qualquer coisa - para recusar o banimento de um admin (ou de si mesmo) sem ter
// fechado a denúncia como procedente.
async function buscarAutorDoAlvo(denuncia: Denuncia) {
  const autor = { select: { id: true, name: true, email: true, papel: true } } as const;

  if (denuncia.alvoTipo === "RECLAMACAO") {
    const reclamacao = await prisma.reclamacao.findUnique({
      where: { id: denuncia.alvoId },
      select: { autor },
    });
    return reclamacao?.autor ?? null;
  }
  if (denuncia.alvoTipo === "COMENTARIO") {
    const comentario = await prisma.comentario.findUnique({
      where: { id: denuncia.alvoId },
      select: { autor },
    });
    return comentario?.autor ?? null;
  }
  return null;
}

type Resolucao =
  | { estado: "ok"; autorId: string; tipo: "RECLAMACAO" | "COMENTARIO" }
  | { estado: "ja-analisada" }
  | { estado: "sem-alvo" };

// Compartilhado por marcarProcedente() e banirAutor() - banir o autor é,
// no mínimo, concordar que a denúncia procede (e normalmente mais grave
// que isso), então fecha a denúncia do mesmo jeito: aplica a consequência
// no alvo (arquiva a reclamação, ou reprova o comentário) e avisa quem
// postou. Sem isto, banirAutor() deixava a denúncia em ABERTA pra sempre,
// reaparecendo na fila mesmo com o problema já resolvido.
//
// A denúncia só é fechada se AINDA estiver aberta (updateMany dentro da mesma
// transação do efeito no alvo): dois moderadores clicando juntos não arquivam
// duas vezes nem mandam duas notificações.
async function resolverComoProcedente(
  denuncia: Denuncia,
  moderadorId: string
): Promise<Resolucao> {
  const fechar = (tx: Pick<typeof prisma, "denuncia">) =>
    tx.denuncia.updateMany({
      where: { id: denuncia.id, status: "ABERTA" },
      data: { status: "PROCEDENTE", analisadoPorId: moderadorId, analisadoEm: new Date() },
    });

  if (denuncia.alvoTipo === "RECLAMACAO") {
    const reclamacao = await prisma.reclamacao.findUnique({
      where: { id: denuncia.alvoId },
    });
    if (!reclamacao) {
      return { estado: "sem-alvo" };
    }

    const decidida = await prisma.$transaction(async (tx) => {
      if ((await fechar(tx)).count === 0) {
        return false;
      }
      await tx.reclamacao.update({
        where: { id: reclamacao.id },
        data: { status: "ARQUIVADA" },
      });
      return true;
    });
    if (!decidida) {
      return { estado: "ja-analisada" };
    }

    await criarNotificacao({
      userId: reclamacao.autorId,
      tipo: "MUDANCA_STATUS",
      texto: { chave: "reclamacaoArquivada", params: { titulo: reclamacao.titulo } },
      reclamacaoId: reclamacao.id,
      protocolo: reclamacao.protocolo,
    });

    revalidatePath("/reclamacoes");
    revalidatePath(`/reclamacoes/${reclamacao.protocolo}`);

    return { estado: "ok", autorId: reclamacao.autorId, tipo: "RECLAMACAO" };
  }

  if (denuncia.alvoTipo === "COMENTARIO") {
    const comentario = await prisma.comentario.findUnique({
      where: { id: denuncia.alvoId },
      include: { reclamacao: { select: { protocolo: true } } },
    });
    if (!comentario) {
      return { estado: "sem-alvo" };
    }

    const decidida = await prisma.$transaction(async (tx) => {
      if ((await fechar(tx)).count === 0) {
        return false;
      }
      // Mesmo campo que a fila de moderação por IA usa pra esconder um
      // comentário (statusModeracao !== "APROVADO" não aparece na
      // reclamação) - uma denúncia procedente tem o mesmo efeito prático
      // de uma reprovação por IA, só que decidida por uma pessoa.
      await tx.comentario.update({
        where: { id: comentario.id },
        data: { statusModeracao: "REPROVADO" },
      });
      return true;
    });
    if (!decidida) {
      return { estado: "ja-analisada" };
    }

    await criarNotificacao({
      userId: comentario.autorId,
      tipo: "MUDANCA_STATUS",
      texto: { chave: "comentarioRemovido" },
      protocolo: comentario.reclamacao.protocolo,
    });

    revalidatePath(`/reclamacoes/${comentario.reclamacao.protocolo}`);

    return { estado: "ok", autorId: comentario.autorId, tipo: "COMENTARIO" };
  }

  return { estado: "sem-alvo" };
}

export async function marcarProcedente(denunciaId: string): Promise<ResultadoAcao> {
  const session = await exigirModerador();
  const t = await getTranslations("Denuncias");

  const denuncia = await buscarDenunciaAberta(denunciaId);
  if (!denuncia) {
    return informacao(t("jaAnalisada"));
  }

  const resolucao = await resolverComoProcedente(denuncia, session.user.id);

  revalidatePath("/denuncias");

  if (resolucao.estado === "ja-analisada") {
    return informacao(t("jaAnalisada"));
  }
  if (resolucao.estado === "sem-alvo") {
    return falha(t("erroConteudoRemovido"));
  }
  return sucesso(
    t(resolucao.tipo === "RECLAMACAO" ? "procedenteReclamacaoOk" : "procedenteComentarioOk")
  );
}

const DIAS_BANIMENTO: Record<string, number> = {
  "7": 7,
  "30": 30,
  permanente: 100 * 365,
};

const DIA_MS = 24 * 60 * 60 * 1000;

// Banir é a ação mais pesada desta tela: o diálogo de confirmação descreve o
// efeito e, no banimento permanente, pede a senha de quem está agindo (conferida
// aqui, não só na tela). Recusa banir um administrador ou a própria conta, e
// nunca ENCURTA um banimento que já vale por mais tempo.
export async function banirAutor(denunciaId: string, formData: FormData): Promise<ResultadoAcao> {
  const session = await exigirAdmin();
  const t = await getTranslations("Denuncias");
  const locale = await getLocale();

  const denuncia = await buscarDenunciaAberta(denunciaId);
  if (!denuncia) {
    return informacao(t("jaAnalisada"));
  }

  const duracao = String(formData.get("duracao"));
  const dias = DIAS_BANIMENTO[duracao];
  if (!dias) {
    return falha(t("erroDuracaoInvalida"));
  }

  const autor = await buscarAutorDoAlvo(denuncia);
  if (!autor) {
    return falha(t("erroConteudoRemovido"));
  }
  if (autor.id === session.user.id) {
    return falha(t("erroBanirProprio"));
  }
  if (autor.papel === "ADMIN") {
    return falha(t("erroBanirAdmin"));
  }

  if (duracao === "permanente") {
    const senhaErrada = await exigirConfirmacaoDeSenha(session.user.id, formData);
    if (senhaErrada) {
      return senhaErrada;
    }
  }

  const resolucao = await resolverComoProcedente(denuncia, session.user.id);
  revalidatePath("/denuncias");
  if (resolucao.estado === "ja-analisada") {
    return informacao(t("jaAnalisada"));
  }
  if (resolucao.estado === "sem-alvo") {
    return falha(t("erroConteudoRemovido"));
  }

  const atual = await prisma.user.findUnique({
    where: { id: autor.id },
    select: { banidoAte: true },
  });
  const novoFim = new Date(Date.now() + dias * DIA_MS);
  const fim = atual?.banidoAte && atual.banidoAte > novoFim ? atual.banidoAte : novoFim;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: autor.id },
      data: { banidoAte: fim },
    });
    await registrarAuditoria(
      {
        acao: "BANIMENTO_APLICADO",
        atorId: session.user.id,
        alvoUserId: autor.id,
        detalhes: { duracao, ate: fim.toISOString(), denunciaId: denuncia.id },
      },
      tx
    );
  });

  const nome = autor.name ?? autor.email;
  return sucesso(
    duracao === "permanente"
      ? t("banidoPermanenteOk", { nome })
      : t("banidoOk", { nome, data: formatarData(fim, locale) })
  );
}
