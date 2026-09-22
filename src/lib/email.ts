import { randomBytes } from "crypto";

import { Resend } from "resend";

import { prisma } from "@/lib/prisma";
import { montarUrl } from "@/lib/url";

const VALIDADE_TOKEN_MS = 24 * 60 * 60 * 1000;
// Mais curto que o de verificação/convite de órgão - redefinir senha é uma
// ação sensível, então o link fica valido por menos tempo.
const VALIDADE_TOKEN_REDEFINICAO_MS = 60 * 60 * 1000;

// Prefixo no identifier (não um campo "tipo" à parte) pra impedir que um
// token de VERIFICAÇÃO de e-mail - que de propósito fica válido até expirar
// naturalmente, já que provedores de e-mail costumam pré-visitar esses
// links (ver comentário em verificar-email/[token]/page.tsx) - seja
// reaproveitado pra REDEFINIR senha. Sem essa distinção, os dois fluxos
// dividiriam a mesma tabela sem nenhum jeito de diferenciar o propósito.
const PREFIXO_REDEFINICAO = "redefinir-senha:";

async function criarToken(identifier: string, validadeMs: number): Promise<string> {
  await prisma.verificationToken.deleteMany({ where: { identifier } });

  const token = randomBytes(32).toString("hex");
  await prisma.verificationToken.create({
    data: {
      identifier,
      token,
      expires: new Date(Date.now() + validadeMs),
    },
  });

  return token;
}

export async function criarTokenVerificacao(email: string): Promise<string> {
  return criarToken(email, VALIDADE_TOKEN_MS);
}

export async function criarTokenRedefinicaoSenha(email: string): Promise<string> {
  return criarToken(`${PREFIXO_REDEFINICAO}${email}`, VALIDADE_TOKEN_REDEFINICAO_MS);
}

// Extrai o e-mail de um identifier de token de redefinição - retorna null
// se o token pertencer a outro propósito (ex.: verificação de e-mail).
export function emailDoTokenRedefinicao(identifier: string): string | null {
  return identifier.startsWith(PREFIXO_REDEFINICAO)
    ? identifier.slice(PREFIXO_REDEFINICAO.length)
    : null;
}

// Sem RESEND_API_KEY configurada, o e-mail fica no log do servidor (útil
// em dev sem depender de provedor). Com a chave, envia de verdade - a
// assinatura não muda, então quem chama não precisa saber qual dos dois.
// Falha no provedor não pode travar o fluxo que chamou isto, só loga.
async function enviarEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[email] "${subject}" para ${to} (Resend não configurado, corpo abaixo)`);
    console.log(html);
    return;
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "Urban Grid <onboarding@resend.dev>",
      to,
      subject,
      html,
    });

    if (error) {
      console.error(`Falha ao enviar e-mail ("${subject}"):`, error);
    }
  } catch (erro) {
    console.error(`Falha ao enviar e-mail ("${subject}"):`, erro);
  }
}

function montarHtmlVerificacao(url: string) {
  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h1 style="color: #1d4ed8; font-size: 20px;">Urban Grid</h1>
      <p style="color: #334155; font-size: 14px; line-height: 1.5;">
        Confirme seu e-mail para ativar sua conta e poder confirmar ou denunciar reclamações.
      </p>
      <a
        href="${url}"
        style="display: inline-block; background: #1d4ed8; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; margin: 8px 0;"
      >
        Verificar e-mail
      </a>
      <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
        Se você não criou uma conta no Urban Grid, ignore este e-mail.
      </p>
    </div>
  `;
}

export async function enviarEmailVerificacao({
  email,
  token,
}: {
  email: string;
  token: string;
}) {
  const url = montarUrl(`/verificar-email/${token}`);
  await enviarEmail({
    to: email,
    subject: "Confirme seu e-mail — Urban Grid",
    html: montarHtmlVerificacao(url),
  });
}

function montarHtmlAcessoOrgao(url: string, nomeOrgao: string) {
  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h1 style="color: #1d4ed8; font-size: 20px;">Urban Grid</h1>
      <p style="color: #334155; font-size: 14px; line-height: 1.5;">
        Sua solicitação de acesso como <strong>${nomeOrgao}</strong> foi aprovada.
        Defina sua senha para começar a responder oficialmente às reclamações da sua cidade.
      </p>
      <a
        href="${url}"
        style="display: inline-block; background: #1d4ed8; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; margin: 8px 0;"
      >
        Definir minha senha
      </a>
      <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
        Este link expira em 24 horas. Se você não reconhece esta solicitação, ignore este e-mail.
      </p>
    </div>
  `;
}

export async function enviarEmailAcessoOrgao({
  email,
  token,
  nomeOrgao,
}: {
  email: string;
  token: string;
  nomeOrgao: string;
}) {
  const url = montarUrl(`/orgao/definir-senha/${token}`);
  await enviarEmail({
    to: email,
    subject: "Acesso de órgão aprovado — Urban Grid",
    html: montarHtmlAcessoOrgao(url, nomeOrgao),
  });
}

function montarHtmlRedefinicaoSenha(url: string) {
  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h1 style="color: #1d4ed8; font-size: 20px;">Urban Grid</h1>
      <p style="color: #334155; font-size: 14px; line-height: 1.5;">
        Recebemos um pedido para redefinir a senha da sua conta.
      </p>
      <a
        href="${url}"
        style="display: inline-block; background: #1d4ed8; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; margin: 8px 0;"
      >
        Criar nova senha
      </a>
      <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
        Este link expira em 1 hora e só pode ser usado uma vez. Se você não
        pediu essa redefinição, ignore este e-mail - sua senha continua a
        mesma.
      </p>
    </div>
  `;
}

export async function enviarEmailRedefinicaoSenha({
  email,
  token,
}: {
  email: string;
  token: string;
}) {
  const url = montarUrl(`/redefinir-senha/${token}`);
  await enviarEmail({
    to: email,
    subject: "Redefinir sua senha — Urban Grid",
    html: montarHtmlRedefinicaoSenha(url),
  });
}

function montarHtmlSolicitacaoRejeitada(motivo: string) {
  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h1 style="color: #1d4ed8; font-size: 20px;">Urban Grid</h1>
      <p style="color: #334155; font-size: 14px; line-height: 1.5;">
        Sua solicitação de acesso como órgão não foi aprovada.
      </p>
      <p style="color: #334155; font-size: 14px; line-height: 1.5;">
        <strong>Motivo:</strong> ${motivo}
      </p>
    </div>
  `;
}

export async function enviarEmailSolicitacaoRejeitada({
  email,
  motivo,
}: {
  email: string;
  motivo: string;
}) {
  await enviarEmail({
    to: email,
    subject: "Solicitação de acesso como órgão — Urban Grid",
    html: montarHtmlSolicitacaoRejeitada(motivo),
  });
}

function montarHtmlNotificacao(titulo: string, mensagem: string, url?: string) {
  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h1 style="color: #1d4ed8; font-size: 20px;">Urban Grid</h1>
      <p style="color: #0f172a; font-size: 16px; font-weight: 600; margin-bottom: 4px;">${titulo}</p>
      <p style="color: #334155; font-size: 14px; line-height: 1.5;">${mensagem}</p>
      ${
        url
          ? `<a
              href="${url}"
              style="display: inline-block; background: #1d4ed8; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; margin: 8px 0;"
            >
              Ver reclamação
            </a>`
          : ""
      }
      <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
        Você recebeu este e-mail porque tem uma conta no Urban Grid.
      </p>
    </div>
  `;
}

// Notificação genérica por e-mail (reclamação publicada/rejeitada,
// resposta oficial, mudança de status, pedido de avaliação) - reusa o
// mesmo template pros diferentes tipos em vez de um HTML por evento.
// Chamada por criarNotificacao(), nunca diretamente pelas actions.
export async function enviarEmailNotificacao({
  email,
  titulo,
  mensagem,
  protocolo,
}: {
  email: string;
  titulo: string;
  mensagem: string;
  protocolo?: string;
}) {
  const url = protocolo ? montarUrl(`/reclamacoes/${protocolo}`) : undefined;
  await enviarEmail({
    to: email,
    subject: `${titulo} — Urban Grid`,
    html: montarHtmlNotificacao(titulo, mensagem, url),
  });
}
