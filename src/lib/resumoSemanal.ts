import { prisma } from "@/lib/prisma";
import { enviarEmailResumoSemanal } from "@/lib/email";
import { montarUrl } from "@/lib/url";
import { idiomaOuPadrao } from "@/i18n/config";
import { nomeCategoriaTraduzido } from "@/lib/categoriaI18n";
import { STATUS_PUBLICOS } from "@/lib/statusPublicos";

export const INTERVALO_RESUMO_MS = 7 * 24 * 60 * 60 * 1000;

// Processa no máximo isso por chamada - o cron roda uma vez por semana
// (ver vercel.json), então nunca deveria ter uma fila grande, mas evita
// que uma execução manual/reexecução acidental tente mandar milhares de
// e-mails de uma vez.
const LIMITE_POR_EXECUCAO = 500;

// Dispara o resumo semanal de cada assinatura elegível (nunca enviado, ou
// enviado há 7 dias ou mais) e sempre marca ultimoEnvioEm = agora ao
// processar - mesmo quando não há reclamação nova pra contar - pra manter
// o ritmo semanal e não escanear a mesma janela vazia em toda execução do
// cron. Retorna quantas assinaturas foram processadas e em quantas saiu
// e-mail de verdade (só quando há reclamação nova).
export async function enviarResumosSemanaisPendentes(): Promise<{
  processadas: number;
  comConteudo: number;
}> {
  const agora = new Date();
  const limiteUltimoEnvio = new Date(agora.getTime() - INTERVALO_RESUMO_MS);

  const assinaturas = await prisma.assinaturaCidade.findMany({
    where: {
      OR: [{ ultimoEnvioEm: null }, { ultimoEnvioEm: { lte: limiteUltimoEnvio } }],
      user: {
        // Conta excluída/anonimizada (ativo=false) fica com o endereço
        // fake removido-<id>@urbangrid.local - excluirConta() já apaga a
        // própria assinatura nesse caso (ver painel/conta/actions.ts),
        // então isto é defesa em profundidade. Banimento é temporário
        // (banidoAte no futuro ou nulo) - suspende o envio enquanto durar,
        // sem cancelar a assinatura, e volta sozinho quando o banimento
        // expirar. Mesmo critério de criarNotificacao(): exige e-mail
        // verificado.
        ativo: true,
        emailVerified: { not: null },
        OR: [{ banidoAte: null }, { banidoAte: { lte: agora } }],
      },
    },
    take: LIMITE_POR_EXECUCAO,
    include: {
      user: { select: { email: true, idioma: true } },
      cidade: { select: { nome: true, slug: true } },
      categoria: { select: { nome: true, slug: true } },
    },
  });

  let comConteudo = 0;

  for (const assinatura of assinaturas) {
    const desde = assinatura.ultimoEnvioEm ?? assinatura.createdAt;

    const total = await prisma.reclamacao.count({
      where: {
        cidadeId: assinatura.cidadeId,
        ...(assinatura.categoriaId ? { categoriaId: assinatura.categoriaId } : {}),
        status: { in: [...STATUS_PUBLICOS] },
        publicadaEm: { gt: desde },
      },
    });

    if (total > 0) {
      comConteudo++;
      try {
        const locale = idiomaOuPadrao(assinatura.user.idioma);
        await enviarEmailResumoSemanal({
          email: assinatura.user.email,
          nomeCidade: assinatura.cidade.nome,
          nomeCategoria: assinatura.categoria
            ? nomeCategoriaTraduzido(assinatura.categoria.slug, assinatura.categoria.nome, locale)
            : null,
          total,
          url: montarUrl(`/cidades/${assinatura.cidade.slug}`),
          locale,
        });
      } catch (erro) {
        // Mesmo padrão de criarNotificacao(): uma falha de envio não pode
        // travar o processamento das outras assinaturas da fila.
        console.error("Falha ao enviar resumo semanal:", erro);
      }
    }

    await prisma.assinaturaCidade.update({
      where: { id: assinatura.id },
      data: { ultimoEnvioEm: agora },
    });
  }

  return { processadas: assinaturas.length, comConteudo };
}
