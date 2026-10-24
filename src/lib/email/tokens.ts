import { randomBytes } from "crypto";

import { prisma } from "@/lib/prisma";

// Tokens de e-mail (verificação/convite, redefinição de senha, troca de e-mail)
// - todos moram na mesma tabela (VerificationToken), distinguidos pelo prefixo
// do identifier.

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

// Apaga todo token pendente de uma conta: verificação/convite (o identifier
// é o próprio e-mail), redefinição de senha e troca de e-mail. Usado na
// exclusão da conta - sem isto, um link pedido antes (válido por até 1h)
// continuava resolvendo pra uma conta já anonimizada. Devolve a operação
// sem executá-la (PrismaPromise) pra caber dentro de um $transaction.
export function apagarTokensPendentes(userId: string, email: string) {
  return prisma.verificationToken.deleteMany({
    where: {
      OR: [
        { identifier: email },
        { identifier: `${PREFIXO_REDEFINICAO}${email}` },
        { identifier: { startsWith: `${PREFIXO_TROCA_EMAIL}${userId}:` } },
      ],
    },
  });
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
