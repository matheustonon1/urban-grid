import type { AssinaturaCidade, Categoria, Cidade, User } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { enviarEmailResumoSemanal } from "@/lib/email";
import { montarUrl } from "@/lib/util/url";
import { idiomaOuPadrao } from "@/i18n/config";
import { nomeCategoriaTraduzido } from "@/lib/reclamacoes/categoriaI18n";
import { STATUS_PUBLICOS } from "@/lib/reclamacoes/statusPublicos";

// O cron roda toda segunda às 9h (ver vercel.json), mas o horário real varia: no plano Hobby da
// Vercel a execução cai em qualquer minuto da hora. `ultimoEnvioEm` guarda o INÍCIO da execução
// anterior, então exigir 7 dias cravados pularia a semana inteira sempre que a seguinte
// começasse alguns segundos antes. Com 6 dias de folga o resumo continua semanal (o cron só
// dispara de 7 em 7) e a variação do horário deixa de importar. Vale também para o resumo do
// órgão (resumoOrgao.ts).
export const INTERVALO_MINIMO_RESUMO_MS = 6 * 24 * 60 * 60 * 1000;

// Processa no máximo isso por chamada - o cron roda uma vez por semana
// (ver vercel.json), então nunca deveria ter uma fila grande, mas evita
// que uma execução manual/reexecução acidental tente mandar milhares de
// e-mails de uma vez.
const LIMITE_POR_EXECUCAO = 500;

// Quantas assinaturas processar em paralelo por vez. Cada uma faz uma
// consulta ao banco e potencialmente uma chamada ao Resend - totalmente
// sequencial (uma de cada vez) fazia a fila inteira esperar a latência de
// rede de cada e-mail somada, arriscando estourar o limite de duração de
// função da Vercel conforme a base de assinantes cresce. Um número
// pequeno é suficiente aqui (não é CPU-bound) e evita abrir conexões
// demais de uma vez com o banco/provedor de e-mail.
const TAMANHO_DO_LOTE = 10;

type AssinaturaComRelacoes = AssinaturaCidade & {
  user: Pick<User, "email" | "idioma">;
  cidade: Pick<Cidade, "nome" | "slug">;
  categoria: Pick<Categoria, "nome" | "slug"> | null;
};

async function processarAssinatura(
  assinatura: AssinaturaComRelacoes,
  agora: Date
): Promise<{ teveConteudo: boolean; falhou: boolean }> {
  const desde = assinatura.ultimoEnvioEm ?? assinatura.createdAt;

  const total = await prisma.reclamacao.count({
    where: {
      cidadeId: assinatura.cidadeId,
      ...(assinatura.categoriaId ? { categoriaId: assinatura.categoriaId } : {}),
      status: { in: [...STATUS_PUBLICOS] },
      publicadaEm: { gt: desde },
    },
  });

  let falhou = false;
  if (total > 0) {
    try {
      const locale = idiomaOuPadrao(assinatura.user.idioma);
      const envio = await enviarEmailResumoSemanal({
        email: assinatura.user.email,
        nomeCidade: assinatura.cidade.nome,
        nomeCategoria: assinatura.categoria
          ? nomeCategoriaTraduzido(assinatura.categoria.slug, assinatura.categoria.nome, locale)
          : null,
        total,
        url: montarUrl(`/cidades/${assinatura.cidade.slug}`),
        locale,
      });
      falhou = envio.status === "falhou";
    } catch (erro) {
      // Mesmo padrão de criarNotificacao(): uma falha de envio não pode
      // travar o processamento das outras assinaturas da fila.
      console.error("Falha ao enviar resumo semanal:", erro);
    }
  }

  // Provedor recusou o e-mail: não marca. A assinatura continua elegível e o próximo resumo
  // cobre desde o último envio de verdade (a janela é `desde`), então nada é perdido; marcar
  // mesmo assim fazia o assinante pular a semana sem ninguém saber.
  if (!falhou) {
    await prisma.assinaturaCidade.update({
      where: { id: assinatura.id },
      data: { ultimoEnvioEm: agora },
    });
  }

  return { teveConteudo: total > 0 && !falhou, falhou };
}

// Dispara o resumo semanal de cada assinatura elegível (nunca enviado, ou
// enviado há 6 dias ou mais - ver INTERVALO_MINIMO_RESUMO_MS) e marca ultimoEnvioEm = agora ao
// processar - mesmo quando não há reclamação nova pra contar - pra manter
// o ritmo semanal e não escanear a mesma janela vazia em toda execução do
// cron. A única exceção é o provedor de e-mail recusar o envio: aí não marca, e a próxima
// execução tenta de novo (cobrindo desde o último envio de verdade). Retorna quantas assinaturas
// foram processadas, em quantas saiu e-mail de verdade (só quando há reclamação nova) e em
// quantas o provedor recusou.
export async function enviarResumosSemanaisPendentes(): Promise<{
  processadas: number;
  comConteudo: number;
  // Assinaturas cujo e-mail o provedor recusou: não foram marcadas e voltam na próxima execução.
  falhas: number;
}> {
  const agora = new Date();
  const limiteUltimoEnvio = new Date(agora.getTime() - INTERVALO_MINIMO_RESUMO_MS);

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
  let falhas = 0;

  for (let inicio = 0; inicio < assinaturas.length; inicio += TAMANHO_DO_LOTE) {
    const lote = assinaturas.slice(inicio, inicio + TAMANHO_DO_LOTE);
    const resultados = await Promise.all(
      lote.map((assinatura) => processarAssinatura(assinatura, agora))
    );
    comConteudo += resultados.filter((resultado) => resultado.teveConteudo).length;
    falhas += resultados.filter((resultado) => resultado.falhou).length;
  }

  return { processadas: assinaturas.length, comConteudo, falhas };
}
