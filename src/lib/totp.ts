import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

import { generateSecret, generateURI, verify } from "otplib";
import bcrypt from "bcryptjs";
import QRCode from "qrcode";

import { prisma } from "@/lib/prisma";

const NOME_EMISSOR = "Urban Grid";
const QUANTIDADE_CODIGOS_BACKUP = 8;
const LIMITE_TENTATIVAS = 5;
const BLOQUEIO_MS = 5 * 60 * 1000;
// ±1 passo de 30s (padrão histórico do otplib) - absorve pequena
// dessincronia de relógio entre o app autenticador e o servidor.
const TOLERANCIA_RELOGIO_SEGUNDOS = 30;

// Chave de cifra derivada de AUTH_SECRET (já usado em cpf.ts para HMAC) -
// evita precisar de uma env var nova só pra isso. totpSecret precisa ser
// reversível (a verificação recalcula o código a partir dele), então é
// cifrado (AES-256-GCM) em vez de hasheado como senha/CPF.
function chaveCifra() {
  return createHash("sha256").update(process.env.AUTH_SECRET!).digest();
}

export function cifrarSegredoTotp(segredo: string): string {
  const iv = randomBytes(12);
  const cifra = createCipheriv("aes-256-gcm", chaveCifra(), iv);
  const cifrado = Buffer.concat([cifra.update(segredo, "utf8"), cifra.final()]);
  const authTag = cifra.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), cifrado.toString("hex")].join(":");
}

export function decifrarSegredoTotp(valor: string): string {
  const [ivHex, authTagHex, cifradoHex] = valor.split(":");
  const decifra = createDecipheriv("aes-256-gcm", chaveCifra(), Buffer.from(ivHex, "hex"));
  decifra.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decifrado = Buffer.concat([
    decifra.update(Buffer.from(cifradoHex, "hex")),
    decifra.final(),
  ]);
  return decifrado.toString("utf8");
}

export function gerarSegredoTotp(): string {
  return generateSecret();
}

export function gerarUriTotp(email: string, segredo: string): string {
  return generateURI({ issuer: NOME_EMISSOR, label: email, secret: segredo });
}

export function gerarQrCodeTotp(uri: string): Promise<string> {
  return QRCode.toDataURL(uri);
}

// afterTimeStep (suporte nativo do otplib) rejeita qualquer código de uma
// janela de 30s já usada ou anterior - sem isso, o mesmo código de 6
// dígitos podia ser reaproveitado por qualquer um que o tivesse visto uma
// vez (print de tela, log, malware no autenticador) durante toda a janela
// de tolerância (~90s), já que só validar "é um código correto pra este
// instante" não distingue "código já gasto" de "código novo". Quem chama
// (auth.ts) precisa persistir o timeStep retornado em
// User.totpUltimoTimeStep pra a proteção valer na tentativa seguinte.
export async function codigoTotpValido(
  segredo: string,
  codigo: string,
  ultimoTimeStepUsado?: number
): Promise<{ valido: boolean; timeStep?: number }> {
  try {
    const resultado = await verify({
      secret: segredo,
      token: codigo.replace(/\s/g, ""),
      epochTolerance: TOLERANCIA_RELOGIO_SEGUNDOS,
      afterTimeStep: ultimoTimeStepUsado,
    });
    if (!resultado.valid) {
      return { valido: false };
    }
    const timeStep = "timeStep" in resultado ? resultado.timeStep : undefined;
    return { valido: true, timeStep };
  } catch {
    return { valido: false };
  }
}

export function gerarCodigosBackup(): string[] {
  return Array.from({ length: QUANTIDADE_CODIGOS_BACKUP }, () =>
    randomBytes(5).toString("hex")
  );
}

// Retorna os dados já com hash, prontos pro `data` de um createMany -
// não executa a escrita aqui, pra o chamador poder incluir a criação
// dos códigos na mesma transação que ativa o 2FA. Se as duas escritas
// não forem atômicas, uma falha entre elas deixa o 2FA ativado sem
// nenhum código de backup utilizável.
export async function prepararCodigosBackup(userId: string, codigos: string[]) {
  return Promise.all(
    codigos.map(async (codigo) => ({
      userId,
      codigoHash: await bcrypt.hash(codigo, 10),
    }))
  );
}

// Cada código de backup só pode ser usado uma vez - se bater, marca
// usadoEm na mesma consulta que valida, pra não reaproveitar em uma
// corrida entre duas tentativas simultâneas com o mesmo código.
export async function consumirCodigoBackup(
  userId: string,
  codigo: string
): Promise<boolean> {
  const candidatos = await prisma.totpBackupCode.findMany({
    where: { userId, usadoEm: null },
  });

  for (const candidato of candidatos) {
    if (await bcrypt.compare(codigo, candidato.codigoHash)) {
      const { count } = await prisma.totpBackupCode.updateMany({
        where: { id: candidato.id, usadoEm: null },
        data: { usadoEm: new Date() },
      });
      if (count > 0) return true;
    }
  }

  return false;
}

// Aplicado só durante o login (authorize) - a verificação em si (código
// certo/errado) fica ali; aqui é só o contador de tentativas e o
// bloqueio temporário, no mesmo padrão de banidoAte já usado no User.
export async function usuarioBloqueadoPorTotp(usuario: {
  totpBloqueadoAte: Date | null;
}): Promise<boolean> {
  return !!usuario.totpBloqueadoAte && usuario.totpBloqueadoAte > new Date();
}

// Incremento atômico no banco (Prisma `increment`), não leitura-depois-
// escrita a partir de um valor lido antes pelo chamador - senão
// tentativas concorrentes leem o mesmo contador desatualizado e todas
// escrevem "valor lido + 1", deixando o contador bem menor que o número
// real de tentativas e o bloqueio nunca dispara sob força bruta paralela.
export async function registrarFalhaTotp(userId: string) {
  const usuario = await prisma.user.update({
    where: { id: userId },
    data: { totpTentativasFalhas: { increment: 1 } },
    select: { totpTentativasFalhas: true },
  });

  if (usuario.totpTentativasFalhas >= LIMITE_TENTATIVAS) {
    await prisma.user.update({
      where: { id: userId },
      data: { totpTentativasFalhas: 0, totpBloqueadoAte: new Date(Date.now() + BLOQUEIO_MS) },
    });
  }
}

// novoTimeStep vem de um login por TOTP de verdade (não por código de
// backup, que tem sua própria proteção de uso único) - persistido na
// mesma escrita pra a próxima verificação já rejeitar esse timeStep (e
// qualquer um anterior) via afterTimeStep em codigoTotpValido().
export async function resetarFalhasTotp(userId: string, novoTimeStep?: number) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      totpTentativasFalhas: 0,
      totpBloqueadoAte: null,
      ...(novoTimeStep !== undefined ? { totpUltimoTimeStep: novoTimeStep } : {}),
    },
  });
}
