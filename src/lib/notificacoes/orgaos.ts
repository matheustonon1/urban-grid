import { prisma } from "@/lib/prisma";

import { criarNotificacao } from "./index";

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

// Avisa no sininho as contas dos órgãos que atendem esta reclamação, assim que ela vira
// pública: antes o órgão só descobria abrindo o painel. "Atende" é a mesma regra da fila
// (cidade, categoria - órgão sem categoria atribuída atende qualquer uma - e, aqui, órgão
// ativo; o órgão da conta que abriu a reclamação fica de fora, porque ele não responde ao que
// ele mesmo abriu: ver lib/orgaos/escopoOrgao.ts).
//
// Chamada logo depois de cada transição para PUBLICADA (moderação automática, aprovação
// manual e publicação após o desfoque). Roda depois de a publicação já ter valido, então
// NUNCA lança: um defeito aqui não pode virar erro para quem publicou nem desfazer nada. Só o
// sininho (sem e-mail por reclamação, que viraria spam em cidade grande): o e-mail do órgão é o
// resumo semanal (lib/notificacoes/resumoOrgao.ts).
export async function avisarOrgaosDaPublicacao(reclamacaoId: string): Promise<void> {
  try {
    const reclamacao = await prisma.reclamacao.findUnique({
      where: { id: reclamacaoId },
      select: {
        titulo: true,
        protocolo: true,
        cidadeId: true,
        categoriaId: true,
        autor: { select: { orgaoId: true } },
      },
    });
    if (!reclamacao) return;

    const orgaos = await prisma.orgao.findMany({
      where: {
        cidadeId: reclamacao.cidadeId,
        ativo: true,
        ...(reclamacao.autor.orgaoId ? { id: { not: reclamacao.autor.orgaoId } } : {}),
        OR: [
          { categorias: { none: {} } },
          { categorias: { some: { id: reclamacao.categoriaId } } },
        ],
      },
      select: { id: true },
    });

    const destinatarios = await responsaveisAtivosDosOrgaos(orgaos.map((orgao) => orgao.id));
    await Promise.all(
      destinatarios.map((userId) =>
        criarNotificacao({
          userId,
          tipo: "NOVA_RECLAMACAO_NA_FILA",
          texto: { chave: "novaReclamacaoNaFila", params: { titulo: reclamacao.titulo } },
          reclamacaoId,
          protocolo: reclamacao.protocolo,
        })
      )
    );
  } catch (erro) {
    console.error("Falha ao avisar os órgãos da reclamação publicada:", erro);
  }
}
