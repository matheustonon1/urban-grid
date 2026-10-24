import { createTranslator } from "use-intl";

import type { Idioma } from "@/i18n/config";

// Textos das notificações do sininho (namespace "Notificacao" de messages/*.json).
//
// Quem dispara a notificação nem sempre é quem a lê - o moderador que arquiva uma
// reclamação, o órgão que responde, o admin que muda um papel -, então o texto é
// montado no idioma de QUEM RECEBE (User.idioma), na hora de criar, e gravado
// pronto no banco: o sininho e o e-mail só exibem. É o mesmo desenho dos e-mails.
// Notificações criadas antes disto ficam no idioma em que foram gravadas.

export type ChaveNotificacao =
  | "reclamacaoPublicada"
  | "reclamacaoRejeitada"
  | "reclamacaoArquivada"
  | "comentarioRemovido"
  | "respostaOficial"
  | "pedidoAvaliacao"
  | "novoComentario"
  | "respostaComentario"
  | "atividadeSuspeita"
  | "papelAlterado"
  | "senhaAlterada"
  | "trocaEmailSolicitada";

export interface TextoNotificacao {
  chave: ChaveNotificacao;
  params?: Record<string, string | number>;
  // Texto escrito por uma pessoa (resposta oficial, comentário): vai como veio,
  // sem passar pela tradução - só o título é traduzido.
  mensagemBruta?: string;
}

export async function montarTexto(
  locale: Idioma,
  { chave, params, mensagemBruta }: TextoNotificacao
): Promise<{ titulo: string; mensagem: string }> {
  const mensagens = (await import(`../../../messages/${locale}.json`)).default;
  const t = createTranslator({ locale, messages: mensagens, namespace: "Notificacao" });

  return {
    titulo: t(`${chave}.titulo`, params),
    mensagem: mensagemBruta ?? t(`${chave}.mensagem`, params),
  };
}
