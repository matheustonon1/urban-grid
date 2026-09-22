import type { TipoNotificacao } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { enviarEmailNotificacao, enviarEmailSenhaAlterada } from "@/lib/email";

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
  titulo,
  mensagem,
  reclamacaoId,
  protocolo,
}: {
  userId: string;
  tipo: TipoNotificacao;
  titulo: string;
  mensagem: string;
  reclamacaoId?: string;
  protocolo?: string;
}) {
  await prisma.notificacao.create({
    data: { userId, tipo, titulo, mensagem, reclamacaoId },
  });

  if (!TIPOS_COM_EMAIL.includes(tipo)) {
    return;
  }

  // Falha ao enviar e-mail não pode derrubar o fluxo que criou a
  // notificação (moderação, resposta oficial, etc.) - a notificação no
  // app já foi criada de qualquer forma, o e-mail é só um reforço.
  try {
    const usuario = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, emailVerified: true },
    });
    if (!usuario?.emailVerified) {
      return;
    }

    await enviarEmailNotificacao({
      email: usuario.email,
      titulo,
      mensagem,
      protocolo,
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
    select: { email: true },
  });
  if (!usuario) {
    return;
  }

  await prisma.notificacao.create({
    data: {
      userId,
      tipo: "CONTA_SEGURANCA",
      titulo: "Sua senha foi alterada",
      mensagem: "Se não foi você, entre em contato com o suporte imediatamente.",
    },
  });

  await enviarEmailSenhaAlterada({ email: usuario.email });
}
