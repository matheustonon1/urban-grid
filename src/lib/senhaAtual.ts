import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import {
  registrarFalhaLogin,
  resetarFalhasLogin,
  usuarioBloqueadoPorLogin,
} from "@/lib/loginSeguranca";

// - "indisponivel": conta sem senha (ex.: já anonimizada) - nada a comparar.
// - "bloqueada": excedeu o limite de tentativas; nem compara.
export type ResultadoSenhaAtual = "ok" | "incorreta" | "bloqueada" | "indisponivel";

// Confirmação de senha pra ações sensíveis feitas DENTRO de uma sessão
// (trocar senha/e-mail, desativar 2FA, gerar códigos de backup, excluir
// conta). Usa o mesmo contador de força bruta do login: sem isso, quem
// tivesse uma sessão roubada ou deixada aberta podia testar senhas sem
// limite por aqui - o contador do login só vale em authorize() - e, ao
// acertar, desligar o 2FA ou trocar o e-mail só com a senha. Um lugar só
// pra essa checagem também evita cinco cópias que divergem numa correção.
export async function verificarSenhaAtual(
  userId: string,
  senha: string
): Promise<ResultadoSenhaAtual> {
  const usuario = await prisma.user.findUnique({
    where: { id: userId },
    select: { senhaHash: true, loginBloqueadoAte: true },
  });
  if (!usuario?.senhaHash) {
    return "indisponivel";
  }
  if (usuarioBloqueadoPorLogin(usuario)) {
    return "bloqueada";
  }

  if (!(await bcrypt.compare(senha, usuario.senhaHash))) {
    await registrarFalhaLogin(userId);
    return "incorreta";
  }

  await resetarFalhasLogin(userId);
  return "ok";
}
