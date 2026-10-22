"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { getTranslations } from "next-intl/server";

import { signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { alertarSenhaAlterada, alertarTrocaEmailSolicitada } from "@/lib/notificacoes";
import {
  apagarTokensPendentes,
  criarTokenTrocaEmail,
  criarTokenVerificacao,
  enviarEmailConfirmarTrocaEmail,
  enviarEmailVerificacao,
} from "@/lib/email";
import { idiomaOuPadrao } from "@/i18n/config";
import { exigirSessao } from "@/lib/seguranca/sessao";
import { excedeuLimitePorIp } from "@/lib/seguranca/rateLimitMemoria";
import { verificarSenhaAtual } from "@/lib/conta/senhaAtual";
import { ESCOPO_REENVIO_VERIFICACAO } from "@/lib/conta/verificacao";

import {
  criarPerfilSchema,
  criarSenhaAtualSchema,
  criarSenhaSchema,
  criarTrocaEmailSchema,
  type PerfilFormState,
  type SenhaAtualFormState,
  type SenhaFormState,
  type TrocaEmailFormState,
} from "./definitions";

export async function atualizarPerfil(
  _state: PerfilFormState,
  formData: FormData
): Promise<PerfilFormState> {
  const t = await getTranslations("Conta");
  const session = await exigirSessao();

  const validado = criarPerfilSchema().safeParse({
    telefone: formData.get("telefone"),
    cidadeId: formData.get("cidadeId") ?? "",
  });
  if (!validado.success) {
    return { erros: validado.error.flatten().fieldErrors };
  }

  const cidadeId = validado.data.cidadeId || null;
  if (cidadeId && !(await prisma.cidade.findUnique({ where: { id: cidadeId }, select: { id: true } }))) {
    return { erros: { cidadeId: [t("erroCidadeInvalida")] } };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { telefone: validado.data.telefone || null, cidadeId },
  });

  revalidatePath("/painel/conta");
  revalidatePath("/painel");

  return { mensagem: t("dadosAtualizados") };
}

// Só afeta os e-mails de "status mudou" (ver TIPOS_COM_EMAIL em
// lib/notificacoes/index.ts) - alertas de segurança (senha alterada, troca de
// e-mail solicitada) continuam saindo sempre, e a notificação no sininho
// nunca para de ser criada. Antes desta ação, não existia nenhum jeito de
// desligar esses e-mails além de nunca verificar o e-mail da conta.
export async function atualizarPreferenciasNotificacao(
  _state: { mensagem?: string } | undefined,
  formData: FormData
): Promise<{ mensagem?: string }> {
  const t = await getTranslations("Conta");
  const session = await exigirSessao();

  await prisma.user.update({
    where: { id: session.user.id },
    data: { notificarPorEmail: formData.get("notificarPorEmail") === "on" },
  });

  revalidatePath("/painel/conta");

  return { mensagem: t("preferenciasAtualizadas") };
}

// Mesma regra de reenviarVerificacao() em painel/actions.ts, mas devolvendo
// um estado pra "Minha conta" mostrar o resultado - aquela é usada direto
// como `<form action>` no painel, que só aceita retorno void.
export async function reenviarVerificacaoEmail(): Promise<{ mensagem?: string }> {
  const t = await getTranslations("Conta");
  const session = await exigirSessao();

  const usuario = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, emailVerified: true, idioma: true },
  });
  if (!usuario) {
    return {};
  }
  if (usuario.emailVerified) {
    return { mensagem: t("emailJaVerificado") };
  }
  // Cada clique manda um e-mail de verdade (cota do provedor) - sem limite,
  // o botão podia ser martelado. Escopo compartilhado com o reenvio do
  // painel (painel/actions.ts), pra um não burlar o outro.
  if (excedeuLimitePorIp(ESCOPO_REENVIO_VERIFICACAO, session.user.id, 3, 10 * 60 * 1000)) {
    return { mensagem: t("erroMuitosEnvios") };
  }

  const token = await criarTokenVerificacao(usuario.email);
  await enviarEmailVerificacao({
    email: usuario.email,
    token,
    locale: idiomaOuPadrao(usuario.idioma),
  });

  return { mensagem: t("verificacaoReenviada", { email: usuario.email }) };
}

// Não existe tabela de sessões (a estratégia é JWT), mas o callback jwt em
// auth.ts já derruba qualquer token emitido antes de senhaAlteradaEm - é
// o que a troca de senha usa. Gravar o campo sem trocar a senha dá o mesmo
// efeito: todos os dispositivos (inclusive este) precisam entrar de novo.
// Por isso o campo não é exibido como "última troca de senha" na tela.
export async function encerrarSessoes() {
  const session = await exigirSessao();

  await prisma.user.update({
    where: { id: session.user.id },
    data: { senhaAlteradaEm: new Date() },
  });

  await signOut({ redirectTo: "/login" });
}

export async function solicitarTrocaEmail(
  _state: TrocaEmailFormState,
  formData: FormData
): Promise<TrocaEmailFormState> {
  const t = await getTranslations("Conta");
  const session = await exigirSessao();

  const validado = criarTrocaEmailSchema(t).safeParse({
    novoEmail: formData.get("novoEmail"),
    senhaAtual: formData.get("senhaAtual"),
  });
  if (!validado.success) {
    return { erros: validado.error.flatten().fieldErrors };
  }

  const { novoEmail, senhaAtual } = validado.data;

  const resultadoSenha = await verificarSenhaAtual(session.user.id, senhaAtual);
  if (resultadoSenha === "bloqueada") {
    return { mensagem: t("erroMuitasTentativas") };
  }
  if (resultadoSenha === "incorreta") {
    return { erros: { senhaAtual: [t("erroSenhaIncorreta")] } };
  }
  const usuario = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (resultadoSenha !== "ok" || !usuario) {
    return { mensagem: t("erroTrocarEmail") };
  }

  if (novoEmail === usuario.email) {
    return { erros: { novoEmail: [t("erroJaEEmailAtual")] } };
  }

  const emailEmUso = await prisma.user.findUnique({ where: { email: novoEmail } });
  if (emailEmUso) {
    return { erros: { novoEmail: [t("erroEmailDuplicado")] } };
  }

  // Manda e-mail pra QUALQUER endereço digitado - sem limite, uma sessão
  // (mesmo com a senha certa) podia usar isto pra encher a caixa de um
  // terceiro e queimar a cota do provedor. Fica depois das checagens acima
  // pra só contar pedidos que de fato enviariam algo.
  if (excedeuLimitePorIp("troca-email", usuario.id, 5, 60 * 60 * 1000)) {
    return { mensagem: t("erroMuitosEnvios") };
  }

  const token = await criarTokenTrocaEmail(usuario.id, novoEmail);
  await enviarEmailConfirmarTrocaEmail({
    email: novoEmail,
    token,
    emailAtual: usuario.email,
    locale: idiomaOuPadrao(usuario.idioma),
  });
  // Aviso pro e-mail atual sai mesmo se falhar o envio acima (enviarEmail
  // nunca lança) - dono da conta precisa saber que uma troca foi pedida,
  // independente do e-mail novo ter recebido o link ou não.
  await alertarTrocaEmailSolicitada(usuario.id, novoEmail);

  return { mensagem: t("linkConfirmacaoEnviado", { email: novoEmail }) };
}

export async function alterarSenha(
  _state: SenhaFormState,
  formData: FormData
): Promise<SenhaFormState> {
  const t = await getTranslations("Conta");
  const session = await exigirSessao();

  const validado = criarSenhaSchema(t).safeParse({
    senhaAtual: formData.get("senhaAtual"),
    novaSenha: formData.get("novaSenha"),
    confirmarNovaSenha: formData.get("confirmarNovaSenha"),
  });
  if (!validado.success) {
    return { erros: validado.error.flatten().fieldErrors };
  }

  const resultadoSenha = await verificarSenhaAtual(session.user.id, validado.data.senhaAtual);
  if (resultadoSenha === "bloqueada") {
    return { mensagem: t("erroMuitasTentativas") };
  }
  if (resultadoSenha === "incorreta") {
    return { erros: { senhaAtual: [t("erroSenhaAtualIncorreta")] } };
  }
  if (resultadoSenha !== "ok") {
    return { mensagem: t("erroAlterarSenha") };
  }

  const novaSenhaHash = await bcrypt.hash(validado.data.novaSenha, 10);
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      senhaHash: novaSenhaHash,
      // Invalida a sessão atual também (não só outras) - ver callback jwt
      // em auth.ts. Evita comportamento assimétrico com a redefinição por
      // e-mail, que também encerra sessões antigas.
      senhaAlteradaEm: new Date(),
    },
  });

  await alertarSenhaAlterada(session.user.id);

  // A própria sessão atual acabou de ser invalidada pela troca acima -
  // encerra explicitamente em vez de deixar a próxima requisição
  // descobrir isso sozinha.
  await signOut({ redirectTo: "/login" });
}

export async function excluirConta(
  _state: SenhaAtualFormState,
  formData: FormData
): Promise<SenhaAtualFormState> {
  const t = await getTranslations("Conta");
  const session = await exigirSessao();

  const validado = criarSenhaAtualSchema(t).safeParse({
    senhaAtual: formData.get("senhaAtual"),
  });
  if (!validado.success) {
    return { erros: validado.error.flatten().fieldErrors };
  }

  const resultadoSenha = await verificarSenhaAtual(session.user.id, validado.data.senhaAtual);
  if (resultadoSenha === "bloqueada") {
    return { mensagem: t("erroMuitasTentativas") };
  }
  if (resultadoSenha === "incorreta") {
    return { erros: { senhaAtual: [t("erroSenhaIncorreta")] } };
  }
  const usuario = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (resultadoSenha !== "ok" || !usuario) {
    return { mensagem: t("erroExcluirConta") };
  }

  // Anonimiza em vez de apagar: preserva as reclamações publicadas como
  // registro de interesse público (sem identificar o autor) e evita
  // violar as FKs que hoje referenciam User a partir de várias tabelas.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: usuario.id },
      data: {
        name: "Usuário removido",
        email: `removido-${usuario.id}@urbangrid.local`,
        senhaHash: null,
        cpfHash: null,
        telefone: null,
        image: null,
        ativo: false,
        // O 2FA acompanha a conta: segredo cifrado e contadores não têm
        // razão de ficar numa conta que nunca mais autentica (os códigos de
        // backup e as notificações saem abaixo).
        totpSecret: null,
        totpConfirmadoEm: null,
        totpTentativasFalhas: 0,
        totpBloqueadoAte: null,
      },
    }),
    prisma.totpBackupCode.deleteMany({ where: { userId: usuario.id } }),
    // Título e mensagem das notificações citam reclamações e e-mails da
    // pessoa; a exclusão promete apagar dados pessoais.
    prisma.notificacao.deleteMany({ where: { userId: usuario.id } }),
    apagarTokensPendentes(usuario.id, usuario.email),
    // ativo=false já impede o cron de resumo semanal de mandar e-mail pra
    // cá (ver filtro em lib/notificacoes/resumoSemanal.ts), mas a assinatura em si ficaria
    // órfã no banco pra sempre sem isso - ninguém nunca mais vai cancelá-la
    // pela tela, já que a conta não loga mais.
    prisma.assinaturaCidade.deleteMany({ where: { userId: usuario.id } }),
    prisma.reclamacao.updateMany({
      where: { autorId: usuario.id },
      data: { anonima: true },
    }),
  ]);

  await signOut({ redirectTo: "/" });
}
