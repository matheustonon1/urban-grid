import type { TipoNotificacao } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  enviarEmailNotificacao,
  enviarEmailSenhaAlterada,
  enviarEmailTrocaEmailSolicitada,
} from "@/lib/email";
import { idiomaOuPadrao } from "@/i18n/config";

import { montarTexto, type TextoNotificacao } from "./textos";

export type { ChaveNotificacao, TextoNotificacao } from "./textos";

// Só os eventos que fazem sentido o cidadão saber mesmo sem estar com o
// app aberto. NOVO_COMENTARIO fica de fora (pode ser frequente demais,
// viraria spam) e ATIVIDADE_SUSPEITA é dirigida a moderadores/admin, não
// ao autor - fica só no sininho mesmo.
const TIPOS_COM_EMAIL: TipoNotificacao[] = [
  "RECLAMACAO_PUBLICADA",
  "RECLAMACAO_REJEITADA",
  "RESPOSTA_OFICIAL",
  "MUDANCA_STATUS",
  "PEDIDO_AVALIACAO",
];

export async function criarNotificacao({
  userId,
  tipo,
  texto,
  reclamacaoId,
  protocolo,
}: {
  userId: string;
  tipo: TipoNotificacao;
  // Chave + parâmetros (ver ./textos): o texto sai no idioma de quem recebe.
  texto: TextoNotificacao;
  reclamacaoId?: string;
  protocolo?: string;
}) {
  // O destinatário é lido primeiro: o idioma decide o texto do sininho e do
  // e-mail, e a mesma leitura serve ao e-mail logo abaixo. Falhar aqui não impede
  // a notificação - cai no idioma padrão e simplesmente não manda e-mail.
  let usuario: {
    email: string;
    emailVerified: Date | null;
    idioma: string | null;
    notificarPorEmail: boolean;
  } | null = null;
  try {
    usuario = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, emailVerified: true, idioma: true, notificarPorEmail: true },
    });
  } catch (erro) {
    console.error("Falha ao ler o destinatário da notificação:", erro);
  }
  const locale = idiomaOuPadrao(usuario?.idioma);
  const { titulo, mensagem } = await montarTexto(locale, texto);

  // Quem chama (aprovar/rejeitar reclamação ou comentário, resposta
  // oficial, denúncia, etc.) já commitou a própria mudança de estado
  // antes de chegar aqui - uma falha nesta escrita (blip de banco, FK)
  // não pode propagar e virar um erro pro moderador/usuário depois que a
  // ação principal já teve efeito. Mesmo espírito do try/catch já
  // existente logo abaixo pro envio de e-mail.
  try {
    await prisma.notificacao.create({
      data: { userId, tipo, titulo, mensagem, reclamacaoId },
    });
  } catch (erro) {
    console.error("Falha ao criar notificação:", erro);
    return;
  }

  if (!TIPOS_COM_EMAIL.includes(tipo)) {
    return;
  }

  // Falha ao enviar e-mail não pode derrubar o fluxo que criou a
  // notificação (moderação, resposta oficial, etc.) - a notificação no
  // app já foi criada de qualquer forma, o e-mail é só um reforço.
  try {
    if (!usuario?.emailVerified || !usuario.notificarPorEmail) {
      return;
    }

    await enviarEmailNotificacao({
      email: usuario.email,
      titulo,
      mensagem,
      protocolo,
      locale,
    });
  } catch (erro) {
    console.error("Falha ao enviar e-mail de notificação:", erro);
  }
}

// Alerta de segurança quando a senha da conta muda (redefinição por
// e-mail ou troca autosserviço em "Minha conta") - sempre notifica e
// sempre manda e-mail, mesmo sem e-mail verificado (ver comentário em
// enviarEmailSenhaAlterada).
export async function alertarSenhaAlterada(userId: string) {
  const usuario = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, idioma: true },
  });
  if (!usuario) {
    return;
  }

  // Mesmo motivo do try/catch em criarNotificacao(): a troca de senha em
  // si já foi commitada antes de chegar aqui - uma falha nesta escrita
  // (blip de banco, FK) não pode propagar e virar um erro pro usuário
  // depois que a ação principal já teve efeito. O e-mail de alerta abaixo
  // é o aviso que realmente importa neste fluxo (chega mesmo sem conta
  // verificada - ver comentário em enviarEmailSenhaAlterada), então sai
  // de qualquer forma mesmo se o registro no sininho falhar.
  const locale = idiomaOuPadrao(usuario.idioma);
  try {
    const { titulo, mensagem } = await montarTexto(locale, { chave: "senhaAlterada" });
    await prisma.notificacao.create({
      data: { userId, tipo: "CONTA_SEGURANCA", titulo, mensagem },
    });
  } catch (erro) {
    console.error("Falha ao criar notificação de senha alterada:", erro);
  }

  await enviarEmailSenhaAlterada({ email: usuario.email, locale });
}

// Mesmo espírito de alertarSenhaAlterada: avisa o e-mail ATUAL assim que
// a troca é pedida (não só quando confirmada) - se não foi o dono da
// conta, ele precisa saber a tempo de agir.
export async function alertarTrocaEmailSolicitada(userId: string, novoEmail: string) {
  const usuario = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, idioma: true },
  });
  if (!usuario) {
    return;
  }

  // Ver comentário equivalente em alertarSenhaAlterada() - mesma rede de
  // segurança que criarNotificacao() já tem, faltando aqui porque esta
  // função monta o registro à mão em vez de reusá-la.
  const locale = idiomaOuPadrao(usuario.idioma);
  try {
    const { titulo, mensagem } = await montarTexto(locale, {
      chave: "trocaEmailSolicitada",
      params: { novoEmail },
    });
    await prisma.notificacao.create({
      data: { userId, tipo: "CONTA_SEGURANCA", titulo, mensagem },
    });
  } catch (erro) {
    console.error("Falha ao criar notificação de troca de e-mail solicitada:", erro);
  }

  await enviarEmailTrocaEmailSolicitada({
    email: usuario.email,
    novoEmail,
    locale,
  });
}
