import { generate } from "otplib";
import type { Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { hashCpf } from "@/lib/seguranca/cpf";
import {
  cifrarSegredoTotp,
  decifrarSegredoTotp,
  gerarCodigosBackup,
  gerarSegredoTotp,
  prepararCodigosBackup,
} from "@/lib/seguranca/totp";

// Confirma o diálogo que as ações protegidas abrem (FormularioAcao): `botao` é o
// rótulo do botão que confirma (não o que abriu o diálogo); `senha` e `codigo` só
// entram quando o diálogo pede a senha e o código de duas etapas de quem está agindo.
// O campo do código é `required`: para provar que a senha errada é recusada, passe
// qualquer código (a senha é conferida antes e não gasta o código).
export async function confirmarDialogo(
  page: Page,
  botao: string | RegExp,
  senha?: string,
  codigo?: string
) {
  const dialogo = page.getByRole("dialog");
  await dialogo.waitFor({ state: "visible" });
  if (senha !== undefined) {
    await dialogo.locator('input[name="senhaConfirmacao"]').fill(senha);
  }
  if (codigo !== undefined) {
    await dialogo.locator('input[name="codigoConfirmacao"]').fill(codigo);
  }
  await dialogo.getByRole("button", { name: botao }).click();
}

// Liga o 2FA da conta direto no banco, com a sessão já aberta (o login de uma conta com
// 2FA pediria o código). Devolve o segredo cifrado, para gerar o código do aplicativo, e
// códigos de backup em claro: cada um vale uma vez e não depende do relógio nem do passo
// de 30 s do TOTP, então são o que os specs usam para confirmar ações protegidas em
// sequência sem esbarrar na proteção contra reuso de código.
export async function ativarDoisFatoresTeste(userId: string, quantidadeBackup = 4) {
  const segredoCifrado = cifrarSegredoTotp(gerarSegredoTotp());
  const codigosBackup = gerarCodigosBackup().slice(0, quantidadeBackup);
  await prisma.user.update({
    where: { id: userId },
    data: { totpSecret: segredoCifrado, totpConfirmadoEm: new Date() },
  });
  await prisma.totpBackupCode.createMany({
    data: await prepararCodigosBackup(userId, codigosBackup),
  });
  return { segredoCifrado, codigosBackup };
}

// Prefixo comum a todo dado criado pelos testes E2E - facilita limpar
// tudo de uma vez caso algum teste quebre antes do próprio afterEach.
export const PREFIXO_TESTE = "e2e-teste";

export function emailTeste(rotulo: string): string {
  return `${PREFIXO_TESTE}-${rotulo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

// Gera um CPF matematicamente válido (dígitos verificadores corretos) -
// necessário porque o cadastro valida o CPF de verdade.
export function gerarCpfValido(): string {
  function calcularDigito(base: string): number {
    let soma = 0;
    let peso = base.length + 1;
    for (const digito of base) {
      soma += Number(digito) * peso;
      peso -= 1;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  }

  let base = "";
  for (let i = 0; i < 9; i++) {
    base += Math.floor(Math.random() * 10);
  }
  base += calcularDigito(base);
  base += calcularDigito(base);
  return base.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export async function criarCidadaoTeste(overrides?: {
  email?: string;
  senha?: string;
  emailVerificado?: boolean;
}) {
  const email = overrides?.email ?? emailTeste("cidadao");
  const senha = overrides?.senha ?? "SenhaForte123";
  const senhaHash = await bcrypt.hash(senha, 10);

  const usuario = await prisma.user.create({
    data: {
      name: "Cidadão E2E",
      email,
      cpfHash: hashCpf(gerarCpfValido()),
      senhaHash,
      papel: "CIDADAO",
      emailVerified: overrides?.emailVerificado === false ? null : new Date(),
      termosAceitosEm: new Date(),
    },
  });

  return { usuario, email, senha };
}

export async function criarAdminTeste(overrides?: { email?: string; senha?: string }) {
  const email = overrides?.email ?? emailTeste("admin");
  const senha = overrides?.senha ?? "SenhaForte123";
  const senhaHash = await bcrypt.hash(senha, 10);

  const usuario = await prisma.user.create({
    data: {
      name: "Admin E2E",
      email,
      senhaHash,
      papel: "ADMIN",
      emailVerified: new Date(),
      termosAceitosEm: new Date(),
    },
  });

  return { usuario, email, senha };
}

export async function criarOrgaoTeste(
  cidadeId: string,
  overrides?: { email?: string; senha?: string; categoriaIds?: string[] }
) {
  const email = overrides?.email ?? emailTeste("orgao");
  const senha = overrides?.senha ?? "SenhaForte123";
  const senhaHash = await bcrypt.hash(senha, 10);

  const orgao = await prisma.orgao.create({
    data: {
      nome: `Órgão E2E ${Date.now()}`,
      cidadeId,
      ...(overrides?.categoriaIds
        ? { categorias: { connect: overrides.categoriaIds.map((id) => ({ id })) } }
        : {}),
    },
  });

  const usuario = await prisma.user.create({
    data: {
      name: "Representante E2E",
      email,
      senhaHash,
      papel: "ORGAO",
      orgaoId: orgao.id,
      emailVerified: new Date(),
      termosAceitosEm: new Date(),
    },
  });

  return { orgao, usuario, email, senha };
}

// Um órgão de NOME LONGO que já aparece no ranking público (home e transparência):
// uma reclamação resolvida e respondida por ele. Só com dados assim as listas de órgãos
// mostram linhas de verdade - com o banco vazio nada disso é renderizado e um nome que
// estoura a largura, ou um número com pouco contraste, passa despercebido.
export async function criarOrgaoNoRanking(cidadeId: string) {
  const { usuario: autor } = await criarCidadaoTeste();
  const { orgao, usuario: responsavel } = await criarOrgaoTeste(cidadeId);
  await prisma.orgao.update({
    where: { id: orgao.id },
    data: {
      nome: `Órgão E2E Secretaria Municipal de Serviços Urbanos, Infraestrutura e Mobilidade ${Date.now()}`,
    },
  });

  const reclamacao = await criarReclamacaoTeste(autor.id, { cidadeId });
  await prisma.reclamacao.update({
    where: { id: reclamacao.id },
    data: { status: "RESOLVIDA", resolvidaEm: new Date() },
  });
  await prisma.respostaOficial.create({
    data: {
      reclamacaoId: reclamacao.id,
      autorId: responsavel.id,
      orgaoId: orgao.id,
      texto: "Problema resolvido pela equipe.",
      novoStatus: "RESOLVIDA",
    },
  });

  return { orgao, reclamacao };
}

// segundosNoFuturo desloca o epoch usado pra gerar o código - útil quando
// o mesmo teste precisa de dois códigos em sequência rápida (ex.: ativa o
// TOTP e loga com ele logo em seguida): sem isso, os dois podem cair na
// mesma janela de 30s por coincidência de tempo real e gerar o MESMO
// código, que codigoTotpValido() (proteção contra reuso) rejeitaria como
// replay na segunda vez - correto em produção, só flakiness aqui no
// teste. +30s garante uma janela seguinte sem depender de quão rápido o
// teste roda, e ainda passa na tolerância de relógio do servidor.
export async function gerarCodigoTotpAtual(
  totpSecretCifrado: string,
  opcoes?: { segundosNoFuturo?: number }
): Promise<string> {
  const segredo = decifrarSegredoTotp(totpSecretCifrado);
  const epoch = opcoes?.segundosNoFuturo
    ? Math.floor(Date.now() / 1000) + opcoes.segundosNoFuturo
    : undefined;
  return generate({ secret: segredo, epoch });
}

// Espera o React terminar de hidratar o elemento: ele pendura __reactProps$...
// no nó do DOM nesse momento. Interagir antes disso é uma corrida: o React
// reescreve valores de campos controlados mexidos à mão (um POST forjado via
// evaluate, por exemplo) e eventos disparados antes de existir ouvinte se
// perdem. O HTML do servidor já está na tela quando o `goto` volta, mas isso
// não quer dizer que a página já responde.
export async function aguardarHidratacao(page: Page, seletor: string) {
  await page.waitForFunction((sel) => {
    const elemento = document.querySelector(sel);
    return !!elemento && Object.keys(elemento).some((chave) => chave.startsWith("__reactProps$"));
  }, seletor);
}

export async function criarReclamacaoTeste(
  autorId: string,
  overrides?: {
    status?: "PUBLICADA" | "REJEITADA" | "EM_MODERACAO" | "AGUARDANDO_REVISAO";
    categoriaId?: string;
    cidadeId?: string;
    motivoRejeicao?: string;
  }
) {
  const categoria =
    overrides?.categoriaId ??
    (await prisma.categoria.findFirst({ where: { ativa: true } }))!.id;
  const cidade =
    overrides?.cidadeId ?? (await prisma.cidade.findFirst())!.id;

  return prisma.reclamacao.create({
    data: {
      titulo: "Reclamação de teste E2E com título válido",
      descricao:
        "Descrição de teste E2E com pelo menos trinta caracteres para passar na validação do formulário.",
      categoriaId: categoria,
      cidadeId: cidade,
      endereco: "Rua de Teste E2E, 123",
      cep: "69900-000",
      autorId,
      status: overrides?.status ?? "PUBLICADA",
      publicadaEm: overrides?.status === "REJEITADA" ? null : new Date(),
      motivoRejeicao: overrides?.motivoRejeicao,
      protocolo: `${PREFIXO_TESTE}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    },
  });
}

// LogModeracao.alvoId é um campo polimórfico (aponta pra Reclamacao OU
// Comentario, conforme alvoTipo), não uma FK de verdade - o cascade do
// Prisma ao apagar a reclamação não alcança essa tabela. Sem isso, o log
// de moderação pendente fica órfão pra sempre: continua contando na
// paginação da fila de revisão, mas o item não existe mais pra exibir.
export async function apagarLogsDeModeracao(where: Prisma.ReclamacaoWhereInput) {
  const reclamacoes = await prisma.reclamacao.findMany({ where, select: { id: true } });
  const reclamacaoIds = reclamacoes.map((r) => r.id);
  if (reclamacaoIds.length === 0) return;

  const comentarios = await prisma.comentario.findMany({
    where: { reclamacaoId: { in: reclamacaoIds } },
    select: { id: true },
  });
  const alvoIds = [...reclamacaoIds, ...comentarios.map((c) => c.id)];

  await prisma.logModeracao.deleteMany({ where: { alvoId: { in: alvoIds } } });
}

// Limpeza best-effort de tudo que os testes E2E possam ter criado,
// identificado pelo prefixo comum em e-mail/protocolo. Chamada nos
// afterEach/afterAll de cada spec - nunca deve lançar (limpeza não pode
// mascarar uma falha real do teste em si).
export async function limparDadosTeste() {
  try {
    const usuarios = await prisma.user.findMany({
      where: { email: { contains: PREFIXO_TESTE } },
      select: { id: true },
    });
    const userIds = usuarios.map((u) => u.id);

    if (userIds.length > 0) {
      await prisma.totpBackupCode.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.notificacao.deleteMany({ where: { userId: { in: userIds } } });
      // O registro de auditoria sobrevive a contas apagadas (FK com SetNull) - para o
      // teste isso é lixo acumulando, então sai junto com os usuários de teste.
      await prisma.registroAuditoria.deleteMany({
        where: { OR: [{ atorId: { in: userIds } }, { alvoUserId: { in: userIds } }] },
      });
      await prisma.respostaOficial.deleteMany({ where: { autorId: { in: userIds } } });
      // Denuncia.denunciante/analisadoPor não tem onDelete: Cascade - sem
      // isso, o deleteMany de User abaixo falha por FK sempre que um teste
      // passa pelo fluxo real de denúncia (e o catch aborta a limpeza toda).
      await prisma.denuncia.deleteMany({
        where: {
          OR: [{ denuncianteId: { in: userIds } }, { analisadoPorId: { in: userIds } }],
        },
      });
    }

    // Por autorId, não só pelo prefixo no protocolo - uma reclamação criada
    // pelo fluxo real (ex.: teste de upload passando pela UI) tem protocolo
    // gerado por gerarProtocolo(), sem o prefixo de teste. Sem isso, o
    // deleteMany de User abaixo falha por FK (autorId) e a função inteira
    // aborta no catch, deixando usuário e reclamação órfãos no banco.
    const filtroReclamacoes: Prisma.ReclamacaoWhereInput = {
      OR: [
        { protocolo: { contains: PREFIXO_TESTE } },
        ...(userIds.length > 0 ? [{ autorId: { in: userIds } }] : []),
      ],
    };
    await apagarLogsDeModeracao(filtroReclamacoes);
    await prisma.reclamacao.deleteMany({ where: filtroReclamacoes });

    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }

    // "contains: 'E2E'" (não só "Órgão E2E") de propósito - o fluxo real
    // de onboarding (orgao-onboarding.spec.ts) cria o órgão com o nome
    // digitado no formulário ("Secretaria E2E ..."), não o helper direto
    // no banco. Órgão não tem onDelete: Cascade a partir de User (é o
    // User que aponta pro Órgão, não o contrário), então um filtro
    // estreito demais deixava esses órgãos órfãos pra sempre, poluindo
    // a lista de /orgaos-categorias a cada rodada de teste.
    // "Órgão Corrida ..." também: solicitacoes-orgao-corrida.spec.ts aprova
    // solicitações pela UI e o órgão nasce com o nome digitado, sem "E2E".
    // Sem isto, cada rodada deixava dois órgãos pra trás; com a lista
    // paginada em 20, o órgão desativado de orgao-desativacao.spec.ts
    // (que vai pro fim da lista) acabava na página 2 e o teste não achava
    // o botão "Reativar".
    await prisma.orgao.deleteMany({
      where: { OR: [{ nome: { contains: "E2E" } }, { nome: { startsWith: "Órgão Corrida" } }] },
    });

    await prisma.solicitacaoOrgao.deleteMany({
      where: { email: { contains: PREFIXO_TESTE } },
    });
    await prisma.solicitacaoCidade.deleteMany({
      where: { email: { contains: PREFIXO_TESTE } },
    });
  } catch (erro) {
    console.error("Falha ao limpar dados de teste E2E (ignorado):", erro);
  }
}
