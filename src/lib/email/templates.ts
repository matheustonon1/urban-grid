import { IDIOMA_PADRAO, type Idioma } from "@/i18n/config";
import { montarUrl } from "@/lib/util/url";

import { esc } from "./html";
import { montarEmail, type TomEmail } from "./layout";
import { rotulosDoLayout, tradutor, type Tradutor } from "./tradutor";
import type { EmailMontado } from "./transporte";

// Um construtor por e-mail: recebe os dados e devolve assunto + HTML + texto,
// SEM enviar nada. Quem envia está em envios.ts; separar os dois deixa testar o
// conteúdo (e gerar a prévia em `npm run email:previa`) sem provedor nenhum.
//
// Regras de escape: texto vindo de usuário/banco entra SEMPRE por esc() (nome de
// órgão, cidade, motivo, título de reclamação). O assunto, por ser cabeçalho
// de texto puro, NÃO é escapado aqui.

type Categoria = "conta" | "seguranca" | "orgao" | "cidade" | "notificacao" | "resumo";

interface Base {
  locale?: Idioma;
}

// Pedaço comum: monta o e-mail com os rótulos fixos e a categoria já traduzida.
function compor(
  t: Tradutor,
  locale: Idioma,
  opcoes: {
    assunto: string;
    preheader: string;
    categoria: Categoria;
    titulo: string;
    tom?: TomEmail;
    blocos: Parameters<typeof montarEmail>[0]["blocos"];
    botao?: { texto: string; url: string };
    // Texto estático do catálogo (será escapado aqui).
    rodape?: string;
    headers?: Record<string, string>;
  }
): EmailMontado {
  const { html, text } = montarEmail({
    idioma: locale,
    rotulos: rotulosDoLayout(t),
    assunto: opcoes.assunto,
    preheader: opcoes.preheader,
    categoria: t(`layout.categoria.${opcoes.categoria}`),
    titulo: opcoes.titulo,
    tom: opcoes.tom,
    blocos: opcoes.blocos,
    botao: opcoes.botao,
    rodape: opcoes.rodape ? esc(opcoes.rodape) : undefined,
  });
  return { assunto: opcoes.assunto, html, text, headers: opcoes.headers };
}

const negrito = (texto: string) => `<strong>${esc(texto)}</strong>`;

export async function montarEmailVerificacao({
  token,
  locale = IDIOMA_PADRAO,
}: Base & { token: string }): Promise<EmailMontado> {
  const t = await tradutor(locale);
  return compor(t, locale, {
    assunto: t("verificacao.assunto"),
    preheader: t("verificacao.preheader"),
    categoria: "conta",
    titulo: t("verificacao.titulo"),
    blocos: [{ tipo: "paragrafo", html: t("verificacao.corpo") }],
    botao: { texto: t("verificacao.botao"), url: montarUrl(`/verificar-email/${token}`) },
    rodape: t("verificacao.rodape"),
  });
}

export async function montarEmailAcessoOrgao({
  token,
  nomeOrgao,
  locale = IDIOMA_PADRAO,
}: Base & { token: string; nomeOrgao: string }): Promise<EmailMontado> {
  const t = await tradutor(locale);
  return compor(t, locale, {
    assunto: t("acessoOrgao.assunto"),
    preheader: t("acessoOrgao.preheader"),
    categoria: "orgao",
    titulo: t("acessoOrgao.titulo"),
    blocos: [{ tipo: "paragrafo", html: t("acessoOrgao.corpo", { nomeOrgao: negrito(nomeOrgao) }) }],
    botao: { texto: t("acessoOrgao.botao"), url: montarUrl(`/orgao/definir-senha/${token}`) },
    rodape: t("acessoOrgao.rodape"),
  });
}

export async function montarEmailRedefinicaoSenha({
  token,
  locale = IDIOMA_PADRAO,
}: Base & { token: string }): Promise<EmailMontado> {
  const t = await tradutor(locale);
  return compor(t, locale, {
    assunto: t("redefinicaoSenha.assunto"),
    preheader: t("redefinicaoSenha.preheader"),
    categoria: "seguranca",
    titulo: t("redefinicaoSenha.titulo"),
    blocos: [{ tipo: "paragrafo", html: t("redefinicaoSenha.corpo") }],
    botao: { texto: t("redefinicaoSenha.botao"), url: montarUrl(`/redefinir-senha/${token}`) },
    rodape: t("redefinicaoSenha.rodape"),
  });
}

export async function montarEmailSenhaAlterada({
  locale = IDIOMA_PADRAO,
}: Base = {}): Promise<EmailMontado> {
  const t = await tradutor(locale);
  return compor(t, locale, {
    assunto: t("senhaAlterada.assunto"),
    preheader: t("senhaAlterada.preheader"),
    categoria: "seguranca",
    titulo: t("senhaAlterada.titulo"),
    tom: "alerta",
    blocos: [
      { tipo: "paragrafo", html: t("senhaAlterada.corpo") },
      { tipo: "destaque", html: `<strong>${esc(t("senhaAlterada.aviso"))}</strong>` },
    ],
  });
}

export async function montarEmailConfirmarTrocaEmail({
  token,
  emailAtual,
  locale = IDIOMA_PADRAO,
}: Base & { token: string; emailAtual: string }): Promise<EmailMontado> {
  const t = await tradutor(locale);
  return compor(t, locale, {
    assunto: t("confirmarTrocaEmail.assunto"),
    preheader: t("confirmarTrocaEmail.preheader"),
    categoria: "seguranca",
    titulo: t("confirmarTrocaEmail.titulo"),
    blocos: [
      {
        tipo: "paragrafo",
        html: t("confirmarTrocaEmail.corpo", { emailAtual: negrito(emailAtual) }),
      },
    ],
    botao: {
      texto: t("confirmarTrocaEmail.botao"),
      url: montarUrl(`/confirmar-email/${token}`),
    },
    rodape: t("confirmarTrocaEmail.rodape"),
  });
}

// Avisa o e-mail ANTIGO assim que a troca é pedida (não só quando é
// confirmada) - se não foi o dono da conta quem pediu, ele precisa saber
// a tempo de agir, antes que o link no e-mail novo seja confirmado.
export async function montarEmailTrocaEmailSolicitada({
  novoEmail,
  locale = IDIOMA_PADRAO,
}: Base & { novoEmail: string }): Promise<EmailMontado> {
  const t = await tradutor(locale);
  return compor(t, locale, {
    assunto: t("trocaEmailSolicitada.assunto"),
    preheader: t("trocaEmailSolicitada.preheader"),
    categoria: "seguranca",
    titulo: t("trocaEmailSolicitada.titulo"),
    tom: "alerta",
    blocos: [
      {
        tipo: "paragrafo",
        html: t("trocaEmailSolicitada.corpo", { novoEmail: negrito(novoEmail) }),
      },
      { tipo: "destaque", html: `<strong>${esc(t("trocaEmailSolicitada.aviso"))}</strong>` },
    ],
  });
}

export async function montarEmailCidadeAprovada({
  nomeCidade,
  locale = IDIOMA_PADRAO,
}: Base & { nomeCidade: string }): Promise<EmailMontado> {
  const t = await tradutor(locale);
  return compor(t, locale, {
    // Sem esc() no assunto de propósito (cabeçalho de texto puro).
    assunto: t("cidadeAprovada.assunto", { cidade: nomeCidade }),
    preheader: t("cidadeAprovada.preheader", { cidade: nomeCidade }),
    categoria: "cidade",
    titulo: t("cidadeAprovada.titulo"),
    blocos: [{ tipo: "paragrafo", html: t("cidadeAprovada.corpo", { cidade: negrito(nomeCidade) }) }],
    botao: { texto: t("cidadeAprovada.botao"), url: montarUrl("/") },
  });
}

export async function montarEmailSolicitacaoCidadeRejeitada({
  motivo,
  locale = IDIOMA_PADRAO,
}: Base & { motivo: string }): Promise<EmailMontado> {
  const t = await tradutor(locale);
  return compor(t, locale, {
    assunto: t("solicitacaoCidadeRejeitada.assunto"),
    preheader: t("solicitacaoCidadeRejeitada.preheader"),
    categoria: "cidade",
    titulo: t("solicitacaoCidadeRejeitada.titulo"),
    blocos: [
      { tipo: "paragrafo", html: t("solicitacaoCidadeRejeitada.corpo") },
      {
        tipo: "destaque",
        rotulo: t("solicitacaoCidadeRejeitada.motivoRotulo").replace(/:$/, ""),
        html: esc(motivo),
      },
    ],
  });
}

export async function montarEmailSolicitacaoRejeitada({
  motivo,
  locale = IDIOMA_PADRAO,
}: Base & { motivo: string }): Promise<EmailMontado> {
  const t = await tradutor(locale);
  return compor(t, locale, {
    assunto: t("solicitacaoRejeitada.assunto"),
    preheader: t("solicitacaoRejeitada.preheader"),
    categoria: "orgao",
    titulo: t("solicitacaoRejeitada.titulo"),
    blocos: [
      { tipo: "paragrafo", html: t("solicitacaoRejeitada.corpo") },
      {
        tipo: "destaque",
        rotulo: t("solicitacaoRejeitada.motivoRotulo").replace(/:$/, ""),
        html: esc(motivo),
      },
    ],
  });
}

// Notificação genérica (reclamação publicada/rejeitada, resposta oficial,
// mudança de status, pedido de avaliação) - o mesmo molde pros diferentes tipos,
// em vez de um HTML por evento. Chamada por criarNotificacao(), nunca
// diretamente pelas actions.
//
// titulo/mensagem NÃO são traduzidos aqui - já chegam prontos em português
// (criarNotificacao() grava o texto final no banco, pra também aparecer no
// sininho do app). Só a moldura do e-mail (botão, rodapé, assunto) respeita o
// idioma de quem recebe; o conteúdo em si exigiria guardar tipo+parâmetros em
// vez de texto pronto - fica pra uma revisão maior do sistema de notificações.
export async function montarEmailNotificacao({
  titulo,
  mensagem,
  protocolo,
  locale = IDIOMA_PADRAO,
}: Base & { titulo: string; mensagem: string; protocolo?: string }): Promise<EmailMontado> {
  const t = await tradutor(locale);
  const resumo = mensagem.length > 110 ? `${mensagem.slice(0, 107)}...` : mensagem;
  return compor(t, locale, {
    assunto: `${titulo} — Urban Grid`,
    preheader: resumo,
    categoria: "notificacao",
    titulo,
    blocos: [
      { tipo: "paragrafo", html: esc(mensagem) },
      ...(protocolo
        ? [{ tipo: "dados" as const, linhas: [{ rotulo: t("notificacao.protocolo"), valor: protocolo }] }]
        : []),
    ],
    botao: protocolo
      ? { texto: t("notificacao.botao"), url: montarUrl(`/reclamacoes/${protocolo}`) }
      : undefined,
    rodape: t("notificacao.rodape"),
  });
}

// Resumo semanal de uma assinatura (cidade + categoria opcional) - ver
// lib/notificacoes/resumoSemanal.ts. total já vem calculado por quem chama; aqui
// só escolhe a mensagem certa (singular/plural, com/sem categoria). nomeCategoria
// vem de fora já traduzido pelo idioma de destino (nome de categoria não é
// conteúdo bilíngue - ver comentário lá).
export async function montarEmailResumoSemanal({
  nomeCidade,
  nomeCategoria,
  total,
  url,
  locale = IDIOMA_PADRAO,
}: Base & {
  nomeCidade: string;
  nomeCategoria: string | null;
  total: number;
  url: string;
}): Promise<EmailMontado> {
  const t = await tradutor(locale);
  const corpo = nomeCategoria
    ? t("resumoSemanal.corpoComCategoria", {
        total,
        cidade: negrito(nomeCidade),
        categoria: negrito(nomeCategoria),
      })
    : t("resumoSemanal.corpoSemCategoria", { total, cidade: negrito(nomeCidade) });

  return compor(t, locale, {
    // Sem esc() aqui de propósito - Subject é cabeçalho de e-mail em texto
    // puro, não HTML. Escapar entregaria "D&#39;Oeste" literal na caixa de
    // entrada pra uma cidade como "Santa Isabel D'Oeste".
    assunto: t("resumoSemanal.assunto", { cidade: nomeCidade }),
    preheader: t("resumoSemanal.preheader", { total, cidade: nomeCidade }),
    categoria: "resumo",
    titulo: t("resumoSemanal.titulo"),
    blocos: [
      { tipo: "numero", valor: String(total), rotulo: t("resumoSemanal.numeroRotulo", { total }) },
      { tipo: "paragrafo", html: corpo },
    ],
    botao: { texto: t("resumoSemanal.botao"), url },
    rodape: t("resumoSemanal.rodape"),
    // Quem não quer mais o resumo cancela na própria tela de assinaturas; o
    // cabeçalho deixa o cliente de e-mail mostrar "cancelar inscrição".
    headers: { "List-Unsubscribe": `<${montarUrl("/painel/assinaturas")}>` },
  });
}
