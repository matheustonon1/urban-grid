"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { falha, informacao, sucesso, type ResultadoAcao } from "@/lib/acoes/resultado";
import { criarTokenVerificacao, enviarEmailAcessoOrgao } from "@/lib/email";
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
  await exigirAdmin();
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
  const atualizacao = await prisma.orgao.updateMany({
    where: { id: orgaoId, ativo: !novoAtivo },
    data: { ativo: novoAtivo },
  });

  revalidatePath("/orgaos-categorias");

  if (atualizacao.count === 0) {
    return informacao(t("orgaoJaNoEstado"));
  }
  return sucesso(t(novoAtivo ? "orgaoReativado" : "orgaoDesativado", { nome: orgao.nome }));
}
