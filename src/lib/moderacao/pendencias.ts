import { prisma } from "@/lib/prisma";

// Quantos itens esperam um moderador, por aba do menu admin (as chaves são as
// de AdminNav). Mesmos filtros das filas de verdade (moderacao/page.tsx,
// moderacao/comentarios/page.tsx e denuncias/page.tsx) - se uma fila mudar o
// critério, o número aqui muda junto ou o menu passa a mentir.
export async function contarPendenciasModeracao(): Promise<Record<string, number>> {
  const [moderacao, comentarios, denuncias] = await Promise.all([
    prisma.reclamacao.count({ where: { status: "AGUARDANDO_REVISAO" } }),
    prisma.logModeracao.count({
      where: { alvoTipo: "COMENTARIO", decisao: "REPROVAR", revisadoEm: null },
    }),
    prisma.denuncia.count({ where: { status: "ABERTA" } }),
  ]);

  return { moderacao, comentarios, denuncias };
}
