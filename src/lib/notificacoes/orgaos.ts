import { prisma } from "@/lib/prisma";

// As contas que respondem em nome de órgãos ATIVOS: quem precisa saber de algo que mexe na
// fila do órgão (reclamação reaberta, por exemplo). Órgão desativado não responde, então
// avisar o responsável dele seria avisar quem não pode agir; conta banida ou excluída
// idem (mesmo critério do resumo semanal).
export async function responsaveisAtivosDosOrgaos(orgaoIds: string[]): Promise<string[]> {
  if (orgaoIds.length === 0) return [];

  const agora = new Date();
  const contas = await prisma.user.findMany({
    where: {
      papel: "ORGAO",
      ativo: true,
      orgaoId: { in: orgaoIds },
      orgao: { ativo: true },
      OR: [{ banidoAte: null }, { banidoAte: { lte: agora } }],
    },
    select: { id: true },
  });

  return contas.map((conta) => conta.id);
}
