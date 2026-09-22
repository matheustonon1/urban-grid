import { generate } from "otplib";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { hashCpf } from "@/lib/cpf";
import { decifrarSegredoTotp } from "@/lib/totp";

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

export async function gerarCodigoTotpAtual(totpSecretCifrado: string): Promise<string> {
  const segredo = decifrarSegredoTotp(totpSecretCifrado);
  return generate({ secret: segredo });
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
    await prisma.orgao.deleteMany({ where: { nome: { contains: "E2E" } } });

    await prisma.solicitacaoOrgao.deleteMany({
      where: { email: { contains: PREFIXO_TESTE } },
    });
  } catch (erro) {
    console.error("Falha ao limpar dados de teste E2E (ignorado):", erro);
  }
}
