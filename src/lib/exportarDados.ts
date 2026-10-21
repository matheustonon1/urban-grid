import { prisma } from "@/lib/prisma";

// Cópia dos dados pessoais da conta pra quem os pedir (LGPD, art. 18 -
// acesso). Fica de fora, de propósito:
// - senhaHash, cpfHash, segredo/códigos de backup do 2FA e contadores de
//   tentativa de login: são credenciais ou estado interno de segurança, não
//   informação que a pessoa precise levar embora - e num arquivo baixado
//   vazariam com facilidade.
// - scoreModeracao, exifJson e LogModeracao: detalhes internos do pipeline
//   de moderação por IA (limiares, GPS bruto das fotos). O resultado que
//   importa pra quem postou (status e motivo de rejeição) vai junto.
export async function montarExportacaoDados(userId: string) {
  const usuario = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      emailVerified: true,
      telefone: true,
      papel: true,
      idioma: true,
      notificarPorEmail: true,
      totpConfirmadoEm: true,
      termosAceitosEm: true,
      criadoDeIp: true,
      createdAt: true,
      cidade: { select: { nome: true, estado: { select: { uf: true } } } },
      reclamacoes: {
        orderBy: { createdAt: "asc" },
        select: {
          protocolo: true,
          titulo: true,
          descricao: true,
          status: true,
          anonima: true,
          endereco: true,
          referencia: true,
          cep: true,
          motivoRejeicao: true,
          textoRecurso: true,
          createdAt: true,
          publicadaEm: true,
          resolvidaEm: true,
          categoria: { select: { nome: true } },
          bairro: { select: { nome: true } },
          cidade: { select: { nome: true, estado: { select: { uf: true } } } },
          midias: {
            orderBy: { ordem: "asc" },
            select: {
              url: true,
              nomeArquivo: true,
              mimeType: true,
              tamanhoBytes: true,
              capturadaEm: true,
            },
          },
        },
      },
      comentarios: {
        orderBy: { createdAt: "asc" },
        select: {
          texto: true,
          statusModeracao: true,
          createdAt: true,
          reclamacao: { select: { protocolo: true } },
        },
      },
      confirmacoes: {
        orderBy: { createdAt: "asc" },
        select: { createdAt: true, reclamacao: { select: { protocolo: true } } },
      },
      avaliacoes: {
        orderBy: { createdAt: "asc" },
        select: {
          nota: true,
          resolvido: true,
          comentario: true,
          createdAt: true,
          reclamacao: { select: { protocolo: true } },
        },
      },
      respostasOficiais: {
        orderBy: { createdAt: "asc" },
        select: {
          texto: true,
          novoStatus: true,
          prazoEstimado: true,
          createdAt: true,
          reclamacao: { select: { protocolo: true } },
        },
      },
      denunciasFeitas: {
        orderBy: { createdAt: "asc" },
        select: {
          alvoTipo: true,
          alvoId: true,
          motivo: true,
          descricao: true,
          status: true,
          createdAt: true,
        },
      },
      assinaturas: {
        orderBy: { createdAt: "asc" },
        select: {
          createdAt: true,
          categoria: { select: { nome: true } },
          cidade: { select: { nome: true, estado: { select: { uf: true } } } },
        },
      },
      notificacoes: {
        orderBy: { createdAt: "asc" },
        select: { tipo: true, titulo: true, mensagem: true, lida: true, createdAt: true },
      },
    },
  });

  const nomeCidade = (cidade: { nome: string; estado: { uf: string } }) =>
    `${cidade.nome} - ${cidade.estado.uf}`;

  return {
    geradoEm: new Date(),
    conta: {
      nome: usuario.name,
      email: usuario.email,
      emailVerificadoEm: usuario.emailVerified,
      telefone: usuario.telefone,
      cidadePadrao: usuario.cidade ? nomeCidade(usuario.cidade) : null,
      papel: usuario.papel,
      idioma: usuario.idioma,
      notificarPorEmail: usuario.notificarPorEmail,
      autenticacaoDuasEtapasAtiva: !!usuario.totpConfirmadoEm,
      termosAceitosEm: usuario.termosAceitosEm,
      ipDoCadastro: usuario.criadoDeIp,
      criadaEm: usuario.createdAt,
    },
    reclamacoes: usuario.reclamacoes.map(({ cidade, categoria, bairro, ...reclamacao }) => ({
      ...reclamacao,
      cidade: nomeCidade(cidade),
      categoria: categoria.nome,
      bairro: bairro?.nome ?? null,
    })),
    comentarios: usuario.comentarios.map(({ reclamacao, ...comentario }) => ({
      reclamacaoProtocolo: reclamacao.protocolo,
      ...comentario,
    })),
    confirmacoes: usuario.confirmacoes.map(({ reclamacao, ...confirmacao }) => ({
      reclamacaoProtocolo: reclamacao.protocolo,
      ...confirmacao,
    })),
    avaliacoes: usuario.avaliacoes.map(({ reclamacao, ...avaliacao }) => ({
      reclamacaoProtocolo: reclamacao.protocolo,
      ...avaliacao,
    })),
    respostasOficiais: usuario.respostasOficiais.map(({ reclamacao, ...resposta }) => ({
      reclamacaoProtocolo: reclamacao.protocolo,
      ...resposta,
    })),
    denunciasFeitas: usuario.denunciasFeitas,
    assinaturas: usuario.assinaturas.map(({ cidade, categoria, createdAt }) => ({
      cidade: nomeCidade(cidade),
      categoria: categoria?.nome ?? null,
      createdAt,
    })),
    notificacoes: usuario.notificacoes,
  };
}
