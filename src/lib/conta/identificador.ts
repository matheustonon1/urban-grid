import { prisma } from "@/lib/prisma";
import { hashCpf, normalizarCpf } from "@/lib/seguranca/cpf";

// "E-mail ou CPF" - detecta qual dos dois foi digitado e busca o usuário.
// Compartilhado entre auth.ts (login de verdade) e login/actions.ts
// (checagem de banimento antes de tentar autenticar).
export async function buscarUsuarioPorIdentificador(identificador: string) {
  const cpfDigitado = normalizarCpf(identificador);

  if (/^\d{11}$/.test(cpfDigitado)) {
    return prisma.user.findUnique({ where: { cpfHash: hashCpf(cpfDigitado) } });
  }

  return prisma.user.findUnique({ where: { email: identificador } });
}
