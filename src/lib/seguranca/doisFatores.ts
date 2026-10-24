import { prisma } from "@/lib/prisma";

// A conta tem a verificação em duas etapas CONFIRMADA (não só iniciada: um segredo
// gerado e ainda não confirmado não conta). As telas usam isto para decidir se o
// diálogo de confirmação pede o código ou manda a pessoa ativar o 2FA.
export async function usuarioTemDoisFatores(userId: string): Promise<boolean> {
  const usuario = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpConfirmadoEm: true },
  });
  return Boolean(usuario?.totpConfirmadoEm);
}
