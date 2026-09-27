import { randomBytes } from "crypto";

import { Resend } from "resend";
import { createTranslator } from "use-intl";

import { prisma } from "@/lib/prisma";
import { montarUrl } from "@/lib/url";
import { IDIOMA_PADRAO, type Idioma } from "@/i18n/config";

// E-mail não tem cookie de navegação de quem vai ler (quem dispara nem
// sempre é o destinatário - moderação, resposta oficial, aprovação de
// órgão) - o idioma vem de onde foi persistido (User.idioma ou
// SolicitacaoOrgao.idioma), passado explicitamente por quem chama. Usa o
// mesmo messages/*.json do resto do site (namespace "Email"), só que via
// createTranslator (use-intl) em vez de next-intl/server, que depende de
// request scope.
async function tradutor(locale: Idioma) {
  const mensagens = (await import(`../../messages/${locale}.json`)).default;
  return createTranslator({ locale, messages: mensagens, namespace: "Email" });
}

// Todo texto que veio de usuário (título de reclamação, motivo de
// rejeição, nome de órgão, resposta oficial...) e entra num template HTML
// precisa passar por aqui - sem isso, quem controla o texto injeta HTML/
// links dentro de um e-mail que sai do remetente oficial do sistema
// (phishing com aparência legítima).
export function esc(texto: string): string {
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

function montarHtmlSimples(
  corpo: string | string[],
  rodape?: string,
  botao?: { url: string; texto: string }
) {
  const paragrafos = Array.isArray(corpo) ? corpo : [corpo];
  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h1 style="color: #1d4ed8; font-size: 20px;">Urban Grid</h1>
      ${paragrafos
        .map(
          (paragrafo) =>
            `<p style="color: #334155; font-size: 14px; line-height: 1.5;">${paragrafo}</p>`
        )
        .join("\n")}
      ${
        botao
          ? `<a
              href="${botao.url}"
              style="display: inline-block; background: #1d4ed8; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; margin: 8px 0;"
            >
              ${botao.texto}
            </a>`
          : ""
      }
      ${
        rodape
          ? `<p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">${rodape}</p>`
          : ""
      }
    </div>
  `;
}

// Alerta de segurança (senha alterada, troca de e-mail pedida) - corpo em
// vermelho/negrito em vez do rodapé cinza padrão, pra chamar mais atenção.
function montarHtmlAlerta(corpo: string, aviso: string) {
  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h1 style="color: #1d4ed8; font-size: 20px;">Urban Grid</h1>
      <p style="color: #334155; font-size: 14px; line-height: 1.5;">
        ${corpo}
      </p>
      <p style="color: #b91c1c; font-size: 14px; line-height: 1.5; font-weight: 600;">
        ${aviso}
      </p>
    </div>
  `;
}

export async function enviarEmailVerificacao({
  email,
  token,
  locale = IDIOMA_PADRAO,
}: {
  email: string;
  token: string;
  locale?: Idioma;
}) {
  const t = await tradutor(locale);
  const url = montarUrl(`/verificar-email/${token}`);
  await enviarEmail({
    to: email,
    subject: t("verificacao.assunto"),
    html: montarHtmlSimples(t("verificacao.corpo"), t("verificacao.rodape"), {
      url,
      texto: t("verificacao.botao"),
    }),
  });
}

export async function enviarEmailAcessoOrgao({
  email,
  token,
  nomeOrgao,
  locale = IDIOMA_PADRAO,
}: {
  email: string;
  token: string;
  nomeOrgao: string;
  locale?: Idioma;
}) {
  const t = await tradutor(locale);
  const url = montarUrl(`/orgao/definir-senha/${token}`);
  await enviarEmail({
    to: email,
    subject: t("acessoOrgao.assunto"),
    html: montarHtmlSimples(
      t("acessoOrgao.corpo", { nomeOrgao: `<strong>${esc(nomeOrgao)}</strong>` }),
      t("acessoOrgao.rodape"),
      { url, texto: t("acessoOrgao.botao") }
    ),
  });
}

export async function enviarEmailRedefinicaoSenha({
  email,
  token,
  locale = IDIOMA_PADRAO,
}: {
  email: string;
  token: string;
  locale?: Idioma;
}) {
  const t = await tradutor(locale);
  const url = montarUrl(`/redefinir-senha/${token}`);
  await enviarEmail({
    to: email,
    subject: t("redefinicaoSenha.assunto"),
    html: montarHtmlSimples(t("redefinicaoSenha.corpo"), t("redefinicaoSenha.rodape"), {
      url,
      texto: t("redefinicaoSenha.botao"),
    }),
  });
}

// Alerta de segurança - diferente das outras funções de e-mail deste
// arquivo, é chamada direto (não passa por criarNotificacao/enviarEmailNotificacao),
// porque não deve depender de e-mail verificado: quem troca a senha pelo
// link de redefinição já provou controlar essa caixa de entrada ao
// clicar nele, então o alerta tem que sair mesmo assim.
export async function enviarEmailSenhaAlterada({
  email,
  locale = IDIOMA_PADRAO,
}: {
  email: string;
  locale?: Idioma;
}) {
  const t = await tradutor(locale);
  await enviarEmail({
    to: email,
    subject: t("senhaAlterada.assunto"),
    html: montarHtmlAlerta(t("senhaAlterada.corpo"), t("senhaAlterada.aviso")),
  });
}

export async function enviarEmailConfirmarTrocaEmail({
  email,
  token,
  emailAtual,
  locale = IDIOMA_PADRAO,
}: {
  email: string;
  token: string;
  emailAtual: string;
  locale?: Idioma;
}) {
  const t = await tradutor(locale);
  const url = montarUrl(`/confirmar-email/${token}`);
  await enviarEmail({
    to: email,
    subject: t("confirmarTrocaEmail.assunto"),
    html: montarHtmlSimples(
      t("confirmarTrocaEmail.corpo", { emailAtual: `<strong>${esc(emailAtual)}</strong>` }),
      t("confirmarTrocaEmail.rodape"),
      { url, texto: t("confirmarTrocaEmail.botao") }
    ),
  });
}

// Avisa o e-mail ANTIGO assim que a troca é pedida (não só quando é
// confirmada) - se não foi o dono da conta quem pediu, ele precisa saber
// a tempo de agir, antes que o link no e-mail novo seja confirmado.
export async function enviarEmailTrocaEmailSolicitada({
  email,
  novoEmail,
  locale = IDIOMA_PADRAO,
}: {
  email: string;
  novoEmail: string;
  locale?: Idioma;
}) {
  const t = await tradutor(locale);
  await enviarEmail({
    to: email,
    subject: t("trocaEmailSolicitada.assunto"),
    html: montarHtmlAlerta(
      t("trocaEmailSolicitada.corpo", { novoEmail: `<strong>${esc(novoEmail)}</strong>` }),
      t("trocaEmailSolicitada.aviso")
    ),
  });
}

export async function enviarEmailSolicitacaoRejeitada({
  email,
  motivo,
  locale = IDIOMA_PADRAO,
}: {
  email: string;
  motivo: string;
  locale?: Idioma;
}) {
  const t = await tradutor(locale);
  await enviarEmail({
    to: email,
    subject: t("solicitacaoRejeitada.assunto"),
    html: montarHtmlSimples([
      t("solicitacaoRejeitada.corpo"),
      `<strong>${t("solicitacaoRejeitada.motivoRotulo")}</strong> ${esc(motivo)}`,
    ]),
  });
}

function montarHtmlNotificacao(titulo: string, mensagem: string, rodape: string, botao?: { url: string; texto: string }) {
  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h1 style="color: #1d4ed8; font-size: 20px;">Urban Grid</h1>
      <p style="color: #0f172a; font-size: 16px; font-weight: 600; margin-bottom: 4px;">${esc(titulo)}</p>
      <p style="color: #334155; font-size: 14px; line-height: 1.5;">${esc(mensagem)}</p>
      ${
        botao
          ? `<a
              href="${botao.url}"
              style="display: inline-block; background: #1d4ed8; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; margin: 8px 0;"
            >
              ${botao.texto}
            </a>`
          : ""
      }
      <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
        ${rodape}
      </p>
    </div>
  `;
}

// Notificação genérica por e-mail (reclamação publicada/rejeitada,
// resposta oficial, mudança de status, pedido de avaliação) - reusa o
// mesmo template pros diferentes tipos em vez de um HTML por evento.
// Chamada por criarNotificacao(), nunca diretamente pelas actions.
//
// titulo/mensagem NÃO são traduzidos aqui - já chegam prontos em
// português (criarNotificacao() grava o texto final no banco, pra
// também aparecer no sininho do app). Só a moldura do e-mail (botão,
// rodapé, assunto) respeita o idioma de quem recebe; o conteúdo em si
// exigiria guardar tipo+parâmetros em vez de texto pronto - fica pra uma
// revisão maior do sistema de notificações, não só do e-mail.
export async function enviarEmailNotificacao({
  email,
  titulo,
  mensagem,
  protocolo,
  locale = IDIOMA_PADRAO,
}: {
  email: string;
  titulo: string;
  mensagem: string;
  protocolo?: string;
  locale?: Idioma;
}) {
  const t = await tradutor(locale);
  const url = protocolo ? montarUrl(`/reclamacoes/${protocolo}`) : undefined;
  await enviarEmail({
    to: email,
    subject: `${titulo} — Urban Grid`,
    html: montarHtmlNotificacao(
      titulo,
      mensagem,
      t("notificacao.rodape"),
      url ? { url, texto: t("notificacao.botao") } : undefined
    ),
  });
}
