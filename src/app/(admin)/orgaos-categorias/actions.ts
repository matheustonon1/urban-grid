"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { exigirReautenticacao } from "@/lib/acoes/confirmarSenha";
import { atencao, falha, informacao, sucesso, type ResultadoAcao } from "@/lib/acoes/resultado";
import { registrarAuditoria } from "@/lib/auditoria";
import { criarTokenVerificacao, enviarEmailAcessoOrgao } from "@/lib/email";
import { alertarDoisFatoresRedefinidos } from "@/lib/notificacoes";
import { idiomaOuPadrao } from "@/i18n/config";

import { criarAtualizarDadosOrgaoSchema, type EstadoConvite } from "./definitions";
import { exigirAdmin } from "../solicitacoes-orgao/exigir-admin";

// Nome/sigla/e-mail vêm direto do que o cidadão digitou no formulário de
// solicitação (SolicitacaoOrgao) e, até aqui, nunca podiam ser corrigidos
// depois de aprovados - um typo aprovado sem reparar ficava preso pra
// sempre sem mexer direto no banco. Cidade fica de fora de propósito: não
// é algo que muda na prática (a secretaria de uma cidade não "muda de
// cidade"), e trocar arrastaria a validação de todas as respostas
// oficiais já ligadas a reclamações da cidade antiga.
export async function atualizarDadosOrgao(
  orgaoId: string,
  formData: FormData
): Promise<ResultadoAcao> {
  await exigirAdmin();

  const t = await getTranslations("OrgaosCategorias");
  const validado = criarAtualizarDadosOrgaoSchema(t).safeParse({
    nome: formData.get("nome"),
    sigla: formData.get("sigla"),
    email: formData.get("email"),
  });
  if (!validado.success) {
    return falha(validado.error.issues[0]?.message ?? t("erroNomeOrgao"));
  }

  try {
    await prisma.orgao.update({
      where: { id: orgaoId },
      data: {
        nome: validado.data.nome,
        sigla: validado.data.sigla || null,
        email: validado.data.email || null,
      },
    });
  } catch (erro) {
    // P2002 = já existe outro órgão com esse nome nesta mesma cidade
    // (constraint @@unique([cidadeId, nome])) - vira uma mensagem na tela em
    // vez de um 500; P2025 = o órgão sumiu entre a página carregar e o envio.
    if (erro instanceof Prisma.PrismaClientKnownRequestError) {
      if (erro.code === "P2002") {
        return falha(t("erroNomeDuplicado"));
      }
      if (erro.code === "P2025") {
        return falha(t("erroOrgaoNaoEncontrado"));
      }
    }
    throw erro;
  }

  revalidatePath("/orgaos-categorias");

  return sucesso(t("dadosSalvos", { nome: validado.data.nome }));
}

export async function atualizarCategoriasOrgao(
  orgaoId: string,
  formData: FormData
): Promise<ResultadoAcao> {
  await exigirAdmin();
  const t = await getTranslations("OrgaosCategorias");

  const categoriaIds = [
    ...new Set(formData.getAll("categoriaIds").filter((v): v is string => typeof v === "string")),
  ];

  const orgao = await prisma.orgao.findUnique({ where: { id: orgaoId } });
  if (!orgao) {
    return falha(t("erroOrgaoNaoEncontrado"));
  }

  if (categoriaIds.length > 0) {
    // Formulário desatualizado (categoria removida entre carregar a
    // página e salvar) ou id adulterado - sem isto, o `set` abaixo
    // lançava P2025 não tratado (500) ao referenciar uma categoria que
    // não existe (mais).
    const categoriasValidas = await prisma.categoria.count({
      where: { id: { in: categoriaIds } },
    });
    if (categoriasValidas !== categoriaIds.length) {
      return falha(t("erroCategoriaInvalida"));
    }
  }

  await prisma.orgao.update({
    where: { id: orgaoId },
    data: { categorias: { set: categoriaIds.map((id) => ({ id })) } },
  });

  revalidatePath("/orgaos-categorias");

  return sucesso(
    categoriaIds.length === 0
      ? t("categoriasSalvasTodas", { nome: orgao.nome })
      : t("categoriasSalvas", { nome: orgao.nome, count: categoriaIds.length })
  );
}

// O token do convite original (enviado na aprovação da solicitação, ver
// aprovarSolicitacao em solicitacoes-orgao/actions.ts) expira em 24h - se
// a pessoa perder o e-mail ou demorar mais que isso pra clicar, a conta
// fica com senhaHash nulo pra sempre: diferente do cidadão comum (que tem
// "reenviar verificação" em /painel), ninguém consegue disparar um novo
// convite, porque quem precisaria dele é justamente quem não consegue
// logar ainda. criarTokenVerificacao() já invalida o token antigo ao
// criar um novo, então reenviar não deixa dois links válidos ao mesmo
// tempo.
//
// Devolve o que aconteceu com o envio (não só "feito"): o provedor de e-mail
// pode recusar (ex.: o remetente de teste do Resend só entrega pro e-mail da
// própria conta) e, sem isto, o admin clicava, nada aparecia e o e-mail
// simplesmente não chegava.
export async function reenviarConviteOrgao(userId: string): Promise<EstadoConvite> {
  await exigirAdmin();

  const usuario = await prisma.user.findUnique({
    where: { id: userId },
    include: { orgao: true },
  });
  if (!usuario || usuario.papel !== "ORGAO" || usuario.senhaHash || !usuario.orgao) {
    return { status: "indisponivel" };
  }

  const token = await criarTokenVerificacao(usuario.email);
  return enviarEmailAcessoOrgao({
    email: usuario.email,
    token,
    nomeOrgao: usuario.orgao.nome,
    locale: idiomaOuPadrao(usuario.idioma),
  });
}

// Único jeito de desligar Orgao.ativo hoje - sem isto, o campo era
// checado em vários lugares (bloqueia resposta oficial de órgão inativo,
// filtra listagens públicas em cidades/orgaos) mas nada na aplicação
// nunca escrevia nele: um órgão extinto ou cadastrado por engano não
// tinha como ser desativado sem mexer direto no banco.
export async function alternarAtivoOrgao(
  orgaoId: string,
  novoAtivo: boolean
): Promise<ResultadoAcao> {
  const session = await exigirAdmin();
  const t = await getTranslations("OrgaosCategorias");

  const orgao = await prisma.orgao.findUnique({
    where: { id: orgaoId },
    select: { nome: true },
  });
  if (!orgao) {
    return falha(t("erroOrgaoNaoEncontrado"));
  }

  // Só grava se o estado atual for o OPOSTO do pedido: dois admins desativando o
  // mesmo órgão (ou um clique em tela desatualizada) viram "nada foi alterado".
  const alterado = await prisma.$transaction(async (tx) => {
    const atualizacao = await tx.orgao.updateMany({
      where: { id: orgaoId, ativo: !novoAtivo },
      data: { ativo: novoAtivo },
    });
    if (atualizacao.count === 0) {
      return false;
    }
    await registrarAuditoria(
      {
        acao: novoAtivo ? "ORGAO_REATIVADO" : "ORGAO_DESATIVADO",
        atorId: session.user.id,
        alvoTipo: "ORGAO",
        alvoId: orgaoId,
      },
      tx
    );
    return true;
  });

  revalidatePath("/orgaos-categorias");

  if (!alterado) {
    return informacao(t("orgaoJaNoEstado"));
  }
  return sucesso(t(novoAtivo ? "orgaoReativado" : "orgaoDesativado", { nome: orgao.nome }));
}

// Conta de órgão que perdeu o aplicativo autenticador E os códigos de backup não consegue entrar: o
// login pede o segundo fator e, para este papel, ele é obrigatório (não se desativa em "Minha
// conta", ver desativarTotp). Sem esta ação a conta ficava presa até alguém mexer no banco.
//
// Devolve a conta ao estado de uma recém-aprovada (só a senha entra, e o proxy / exigirOrgao levam
// direto a ativar o segundo fator de novo), então tem as mesmas travas de privilégio de mudar
// papel: só admin; senha E código de duas etapas de quem age, conferidos aqui no servidor;
// auditoria na mesma transação; e aviso à conta afetada (sininho + e-mail).
//
// Também encerra as sessões abertas dela (`senhaAlteradaEm`, ver o callback jwt em auth.ts): se a
// conta estiver nas mãos de outra pessoa, essa sessão não pode ativar um segundo fator PRÓPRIO e
// trancar a dona legítima do lado de fora.
export async function redefinirDoisFatoresOrgao(
  userId: string,
  formData: FormData
): Promise<ResultadoAcao> {
  const session = await exigirAdmin();
  const t = await getTranslations("OrgaosCategorias");

  const conta = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, papel: true, orgaoId: true, totpConfirmadoEm: true },
  });
  // Só conta de órgão: nos outros papéis o 2FA é opcional e a própria pessoa o desativa.
  if (!conta || conta.papel !== "ORGAO" || !conta.orgaoId) {
    return falha(t("erroContaIndisponivel"));
  }
  const { email } = conta;
  if (!conta.totpConfirmadoEm) {
    return informacao(t("doisFatoresJaRedefinidos", { email }));
  }

  // Senha E código de duas etapas: devolver uma conta a "só senha" é conceder acesso.
  const reautenticacao = await exigirReautenticacao(session.user.id, formData);
  if (reautenticacao) {
    return reautenticacao;
  }

  const agora = new Date();
  const aplicado = await prisma.$transaction(async (tx) => {
    // Guarda no WHERE: dois admins redefinindo a mesma conta (ou a pessoa ativando de novo entre a
    // leitura e aqui) viram "nada foi alterado".
    const atualizacao = await tx.user.updateMany({
      where: { id: userId, papel: "ORGAO", totpConfirmadoEm: { not: null } },
      data: {
        totpSecret: null,
        totpConfirmadoEm: null,
        totpTentativasFalhas: 0,
        totpBloqueadoAte: null,
        totpUltimoTimeStep: null,
        senhaAlteradaEm: agora,
      },
    });
    if (atualizacao.count === 0) {
      return false;
    }
    await tx.totpBackupCode.deleteMany({ where: { userId } });
    // Sem copiar e-mail nem nome para `detalhes`: a tela de auditoria lê da conta de origem.
    await registrarAuditoria(
      { acao: "DOIS_FATORES_REDEFINIDO", atorId: session.user.id, alvoUserId: userId },
      tx
    );
    return true;
  });

  revalidatePath("/orgaos-categorias");
  revalidatePath("/auditoria");

  if (!aplicado) {
    return informacao(t("doisFatoresJaRedefinidos", { email }));
  }

  // A redefinição já valeu; o aviso é o que a torna segura. Se o e-mail não saiu, o admin precisa
  // saber agora para avisar a pessoa por outro canal.
  const aviso = await alertarDoisFatoresRedefinidos(userId);
  if (!aviso || aviso.status !== "enviado") {
    return atencao(t("doisFatoresRedefinidosSemAviso", { email }));
  }
  return sucesso(t("doisFatoresRedefinidos", { email }));
}
