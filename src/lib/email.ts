import { randomBytes } from "crypto";

import { Resend } from "resend";

import { prisma } from "@/lib/prisma";
import { montarUrl } from "@/lib/url";

// Todo texto que veio de usuário (título de reclamação, motivo de
// rejeição, nome de órgão, resposta oficial...) e entra num template HTML
// precisa passar por aqui - sem isso, quem controla o texto injeta HTML/
// links dentro de um e-mail que sai do remetente oficial do sistema
// (phishing com aparência legítima).
function esc(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
// Sensível como redefinir senha (muda a credencial de login) - mesma
// validade curta. Guarda userId + e-mail novo no identifier porque o
// token de confirmação precisa saber os dois: qual conta muda, e pra
// qual e-mail (diferente dos outros fluxos, que só têm um e-mail
// envolvido).
const PREFIXO_TROCA_EMAIL = "trocar-email:";
const VALIDADE_TOKEN_TROCA_EMAIL_MS = 60 * 60 * 1000;

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

export async function criarTokenTrocaEmail(userId: string, novoEmail: string): Promise<string> {
  // Limpa qualquer pedido de troca anterior deste usuário (pra e-mail
  // diferente, por exemplo) antes de criar o novo - o deleteMany() do
  // criarToken() só limparia por identifier exato, que aqui muda a cada
  // e-mail novo pedido.
  await prisma.verificationToken.deleteMany({
    where: { identifier: { startsWith: `${PREFIXO_TROCA_EMAIL}${userId}:` } },
  });
  return criarToken(`${PREFIXO_TROCA_EMAIL}${userId}:${novoEmail}`, VALIDADE_TOKEN_TROCA_EMAIL_MS);
}

// userId não tem ":" (é um cuid), então o primeiro ":" depois do prefixo
// separa ele do e-mail novo - retorna null se o token for de outro propósito.
export function dadosDoTokenTrocaEmail(
  identifier: string
): { userId: string; novoEmail: string } | null {
  if (!identifier.startsWith(PREFIXO_TROCA_EMAIL)) return null;

  const resto = identifier.slice(PREFIXO_TROCA_EMAIL.length);
  const indiceSeparador = resto.indexOf(":");
  if (indiceSeparador === -1) return null;

  return {
    userId: resto.slice(0, indiceSeparador),
    novoEmail: resto.slice(indiceSeparador + 1),
  };
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
        Sua solicitação de acesso como <strong>${esc(nomeOrgao)}</strong> foi aprovada.
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

function montarHtmlSenhaAlterada() {
  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h1 style="color: #1d4ed8; font-size: 20px;">Urban Grid</h1>
      <p style="color: #334155; font-size: 14px; line-height: 1.5;">
        A senha da sua conta foi alterada agora.
      </p>
      <p style="color: #b91c1c; font-size: 14px; line-height: 1.5; font-weight: 600;">
        Se não foi você, sua conta pode estar comprometida — troque a
        senha imediatamente e entre em contato com o suporte.
      </p>
    </div>
  `;
}

// Alerta de segurança - diferente das outras funções de e-mail deste
// arquivo, é chamada direto (não passa por criarNotificacao/enviarEmailNotificacao),
// porque não deve depender de e-mail verificado: quem troca a senha pelo
// link de redefinição já provou controlar essa caixa de entrada ao
// clicar nele, então o alerta tem que sair mesmo assim.
export async function enviarEmailSenhaAlterada({ email }: { email: string }) {
  await enviarEmail({
    to: email,
    subject: "Sua senha foi alterada — Urban Grid",
    html: montarHtmlSenhaAlterada(),
  });
}

function montarHtmlConfirmarTrocaEmail(url: string, emailAtual: string) {
  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h1 style="color: #1d4ed8; font-size: 20px;">Urban Grid</h1>
      <p style="color: #334155; font-size: 14px; line-height: 1.5;">
        Recebemos um pedido para trocar o e-mail de acesso da conta
        <strong>${esc(emailAtual)}</strong> para este endereço.
      </p>
      <a
        href="${url}"
        style="display: inline-block; background: #1d4ed8; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; margin: 8px 0;"
      >
        Confirmar novo e-mail
      </a>
      <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
        Este link expira em 1 hora. Se você não pediu essa troca, ignore
        este e-mail - seu e-mail de acesso continua o mesmo.
      </p>
    </div>
  `;
}

export async function enviarEmailConfirmarTrocaEmail({
  email,
  token,
  emailAtual,
}: {
  email: string;
  token: string;
  emailAtual: string;
}) {
  const url = montarUrl(`/confirmar-email/${token}`);
  await enviarEmail({
    to: email,
    subject: "Confirme seu novo e-mail — Urban Grid",
    html: montarHtmlConfirmarTrocaEmail(url, emailAtual),
  });
}

function montarHtmlTrocaEmailSolicitada(novoEmail: string) {
  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h1 style="color: #1d4ed8; font-size: 20px;">Urban Grid</h1>
      <p style="color: #334155; font-size: 14px; line-height: 1.5;">
        Pediram a troca do e-mail de acesso da sua conta para
        <strong>${esc(novoEmail)}</strong>. A troca só passa a valer depois de
        confirmada pelo novo endereço.
      </p>
      <p style="color: #b91c1c; font-size: 14px; line-height: 1.5; font-weight: 600;">
        Se não foi você, sua conta pode estar comprometida - troque sua
        senha imediatamente.
      </p>
    </div>
  `;
}

// Avisa o e-mail ANTIGO assim que a troca é pedida (não só quando é
// confirmada) - se não foi o dono da conta quem pediu, ele precisa saber
// a tempo de agir, antes que o link no e-mail novo seja confirmado.
export async function enviarEmailTrocaEmailSolicitada({
  email,
  novoEmail,
}: {
  email: string;
  novoEmail: string;
}) {
  await enviarEmail({
    to: email,
    subject: "Troca de e-mail solicitada — Urban Grid",
    html: montarHtmlTrocaEmailSolicitada(novoEmail),
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
        <strong>Motivo:</strong> ${esc(motivo)}
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
      <p style="color: #0f172a; font-size: 16px; font-weight: 600; margin-bottom: 4px;">${esc(titulo)}</p>
      <p style="color: #334155; font-size: 14px; line-height: 1.5;">${esc(mensagem)}</p>
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
