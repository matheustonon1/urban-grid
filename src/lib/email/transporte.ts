import { Resend } from "resend";

import { assuntoSeguro } from "./html";

// O que aconteceu com um envio: "enviado" (o provedor aceitou), "simulado" (sem
// RESEND_API_KEY, o e-mail só foi para o log do servidor) ou "falhou" (o
// provedor recusou ou a rede caiu; `motivo` é a mensagem dele).
export type ResultadoEnvio =
  | { status: "enviado" }
  | { status: "simulado" }
  | { status: "falhou"; motivo: string };

export interface EmailMontado {
  assunto: string;
  html: string;
  // Versão text/plain da mesma mensagem: melhora a entrega (filtros desconfiam
  // de e-mail só-HTML) e atende quem lê sem HTML.
  text: string;
  // Cabeçalhos extras (ex.: List-Unsubscribe nos resumos semanais).
  headers?: Record<string, string>;
}

// Sem RESEND_API_KEY configurada, o e-mail fica no log do servidor (útil
// em dev sem depender de provedor). Com a chave, envia de verdade - a
// assinatura não muda, então quem chama não precisa saber qual dos dois.
// Falha no provedor não pode travar o fluxo que chamou isto: só loga e
// devolve o resultado, pra quem tem uma tela (ex.: "reenviar convite")
// poder contar o que houve em vez de a pessoa achar que deu certo.
export async function enviarEmail({
  to,
  assunto,
  html,
  text,
  headers,
}: EmailMontado & { to: string }): Promise<ResultadoEnvio> {
  const subject = assuntoSeguro(assunto);

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[email] "${subject}" para ${to} (Resend não configurado, corpo abaixo)`);
    console.log(text);
    return { status: "simulado" };
  }

  const registrarFalha = (detalhe: unknown) => {
    console.error(`Falha ao enviar e-mail ("${subject}") para ${to}:`, detalhe);
    // Em dev, o corpo (com o link) vai pro log também: o provedor de teste do
    // Resend só entrega pro e-mail da própria conta, e sem isto o link do
    // convite ficaria inacessível. Em produção o link não vai pra log.
    if (process.env.NODE_ENV !== "production") console.log(text);
  };

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "Urban Grid <onboarding@resend.dev>",
      to,
      subject,
      html,
      text,
      ...(headers ? { headers } : {}),
    });

    if (error) {
      registrarFalha(error);
      return { status: "falhou", motivo: error.message };
    }
    return { status: "enviado" };
  } catch (erro) {
    registrarFalha(erro);
    return { status: "falhou", motivo: erro instanceof Error ? erro.message : String(erro) };
  }
}
