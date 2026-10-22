import { IDIOMA_PADRAO, type Idioma } from "@/i18n/config";

import {
  montarEmailAcessoOrgao,
  montarEmailCidadeAprovada,
  montarEmailConfirmarTrocaEmail,
  montarEmailNotificacao,
  montarEmailRedefinicaoSenha,
  montarEmailResumoSemanal,
  montarEmailSenhaAlterada,
  montarEmailSolicitacaoCidadeRejeitada,
  montarEmailSolicitacaoRejeitada,
  montarEmailTrocaEmailSolicitada,
  montarEmailVerificacao,
} from "./templates";
import { enviarEmail, type ResultadoEnvio } from "./transporte";

// Uma função por situação do produto: monta o e-mail (templates.ts) e entrega
// (transporte.ts). Falha no provedor nunca lança - ver enviarEmail().

export async function enviarEmailVerificacao({
  email,
  token,
  locale = IDIOMA_PADRAO,
}: {
  email: string;
  token: string;
  locale?: Idioma;
}) {
  await enviarEmail({ to: email, ...(await montarEmailVerificacao({ token, locale })) });
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
}): Promise<ResultadoEnvio> {
  return enviarEmail({
    to: email,
    ...(await montarEmailAcessoOrgao({ token, nomeOrgao, locale })),
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
  await enviarEmail({ to: email, ...(await montarEmailRedefinicaoSenha({ token, locale })) });
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
  await enviarEmail({ to: email, ...(await montarEmailSenhaAlterada({ locale })) });
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
  await enviarEmail({
    to: email,
    ...(await montarEmailConfirmarTrocaEmail({ token, emailAtual, locale })),
  });
}

export async function enviarEmailTrocaEmailSolicitada({
  email,
  novoEmail,
  locale = IDIOMA_PADRAO,
}: {
  email: string;
  novoEmail: string;
  locale?: Idioma;
}) {
  await enviarEmail({
    to: email,
    ...(await montarEmailTrocaEmailSolicitada({ novoEmail, locale })),
  });
}

export async function enviarEmailCidadeAprovada({
  email,
  nomeCidade,
  locale = IDIOMA_PADRAO,
}: {
  email: string;
  nomeCidade: string;
  locale?: Idioma;
}) {
  await enviarEmail({
    to: email,
    ...(await montarEmailCidadeAprovada({ nomeCidade, locale })),
  });
}

export async function enviarEmailSolicitacaoCidadeRejeitada({
  email,
  motivo,
  locale = IDIOMA_PADRAO,
}: {
  email: string;
  motivo: string;
  locale?: Idioma;
}) {
  await enviarEmail({
    to: email,
    ...(await montarEmailSolicitacaoCidadeRejeitada({ motivo, locale })),
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
  await enviarEmail({
    to: email,
    ...(await montarEmailSolicitacaoRejeitada({ motivo, locale })),
  });
}

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
  await enviarEmail({
    to: email,
    ...(await montarEmailNotificacao({ titulo, mensagem, protocolo, locale })),
  });
}

export async function enviarEmailResumoSemanal({
  email,
  nomeCidade,
  nomeCategoria,
  total,
  url,
  locale = IDIOMA_PADRAO,
}: {
  email: string;
  nomeCidade: string;
  nomeCategoria: string | null;
  total: number;
  url: string;
  locale?: Idioma;
}) {
  await enviarEmail({
    to: email,
    ...(await montarEmailResumoSemanal({ nomeCidade, nomeCategoria, total, url, locale })),
  });
}
