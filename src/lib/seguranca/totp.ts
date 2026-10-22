import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

import { generateSecret, generateURI, verify } from "otplib";
import bcrypt from "bcryptjs";
import QRCode from "qrcode";

import { prisma } from "@/lib/prisma";
import { criarContadorDeFalhas } from "@/lib/seguranca/contadorFalhas";

const NOME_EMISSOR = "Urban Grid";
export const QUANTIDADE_CODIGOS_BACKUP = 8;
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
// (auth.ts) precisa reservar o timeStep retornado com reservarTimeStepTotp()
// pra a proteção valer na tentativa seguinte - e valer mesmo sob tentativas
// simultâneas, que esta leitura sozinha não impede.
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

// Formato dos códigos gerados por gerarCodigosBackup(): 5 bytes em hex.
const FORMATO_CODIGO_BACKUP = /^[0-9a-f]{10}$/;

// Cada código de backup só pode ser usado uma vez - se bater, marca
// usadoEm na mesma consulta que valida, pra não reaproveitar em uma
// corrida entre duas tentativas simultâneas com o mesmo código.
export async function consumirCodigoBackup(
  userId: string,
  codigoDigitado: string
): Promise<boolean> {
  // Quem digita (ou cola) o código costuma errar na caixa ou deixar um
  // espaço - e cada recusa conta como falha no bloqueio de 5 min, justo
  // quando a pessoa perdeu o app autenticador. Também evita pagar até 8
  // bcrypt.compare por uma entrada que nem tem o formato de um código.
  const codigo = codigoDigitado.replace(/\s/g, "").toLowerCase();
  if (!FORMATO_CODIGO_BACKUP.test(codigo)) {
    return false;
  }

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
// Mesma técnica de contador usada em loginSeguranca.ts pro login por
// senha (ver criarContadorDeFalhas) - limite/janela diferentes, mas o
// algoritmo (incremento atômico, checa limite, bloqueia) é o mesmo.
const contador = criarContadorDeFalhas({
  campoTentativas: "totpTentativasFalhas",
  campoBloqueio: "totpBloqueadoAte",
  limiteTentativas: LIMITE_TENTATIVAS,
  bloqueioMs: BLOQUEIO_MS,
});

export async function usuarioBloqueadoPorTotp(usuario: {
  totpBloqueadoAte: Date | null;
}): Promise<boolean> {
  return contador.estaBloqueado(usuario);
}

export const registrarFalhaTotp = contador.registrarFalha;

export async function resetarFalhasTotp(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { totpTentativasFalhas: 0, totpBloqueadoAte: null },
  });
}

// "Gasta" o timeStep de um código TOTP já validado por codigoTotpValido():
// grava como último usado SÓ se for maior que o gravado (ou se não houver),
// num único UPDATE condicional, e diz se foi esta chamada que conseguiu.
// Antes o login lia totpUltimoTimeStep, validava e gravava o novo depois,
// incondicionalmente - duas tentativas simultâneas com o mesmo código (visto
// por terceiro) liam o mesmo valor, as duas passavam, e uma escrita tardia
// podia até regredir o campo e reabrir a janela de replay. Aqui, só uma
// vence; a outra é tratada como código já usado. Não vale pra código de
// backup, que tem a própria proteção de uso único (consumirCodigoBackup).
export async function reservarTimeStepTotp(userId: string, timeStep: number): Promise<boolean> {
  const { count } = await prisma.user.updateMany({
    where: {
      id: userId,
      OR: [{ totpUltimoTimeStep: null }, { totpUltimoTimeStep: { lt: timeStep } }],
    },
    data: { totpUltimoTimeStep: timeStep },
  });
  return count > 0;
}
