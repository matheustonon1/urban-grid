import { describe, expect, it } from "vitest";

import type { Idioma } from "@/i18n/config";

import { montarTexto, type ChaveNotificacao, type TextoNotificacao } from "./textos";

// Uma entrada por chave de ChaveNotificacao, com os parâmetros que o texto usa. O tipo
// Record faz o TypeScript exigir uma entrada nova sempre que a união ganhar uma chave -
// e o teste abaixo falha se faltar a mensagem em algum idioma.
const EXEMPLOS: Record<ChaveNotificacao, TextoNotificacao> = {
  reclamacaoPublicada: { chave: "reclamacaoPublicada", params: { titulo: "Buraco" } },
  reclamacaoRejeitada: {
    chave: "reclamacaoRejeitada",
    params: { titulo: "Buraco", motivo: "Fora de escopo" },
  },
  reclamacaoArquivada: { chave: "reclamacaoArquivada", params: { titulo: "Buraco" } },
  comentarioRemovido: { chave: "comentarioRemovido" },
  respostaOficial: {
    chave: "respostaOficial",
    params: { orgao: "Obras" },
    mensagemBruta: "Vamos ao local.",
  },
  pedidoAvaliacao: { chave: "pedidoAvaliacao", params: { orgao: "Obras", titulo: "Buraco" } },
  novoComentario: { chave: "novoComentario", mensagemBruta: "Concordo." },
  respostaComentario: { chave: "respostaComentario", mensagemBruta: "Concordo." },
  atividadeSuspeita: { chave: "atividadeSuspeita", params: { confirmacoes: 15, minutos: 30 } },
  papelAlterado: { chave: "papelAlterado", params: { papel: "MODERADOR" } },
  senhaAlterada: { chave: "senhaAlterada" },
  trocaEmailSolicitada: { chave: "trocaEmailSolicitada", params: { novoEmail: "novo@example.com" } },
};

const IDIOMAS: Idioma[] = ["pt-BR", "en"];

describe("montarTexto", () => {
  for (const idioma of IDIOMAS) {
    it(`todas as chaves têm título e mensagem em ${idioma}, sem chave crua nem parâmetro faltando`, async () => {
      for (const texto of Object.values(EXEMPLOS)) {
        const { titulo, mensagem } = await montarTexto(idioma, texto);

        expect(titulo.length, `${texto.chave} (título)`).toBeGreaterThan(0);
        expect(mensagem.length, `${texto.chave} (mensagem)`).toBeGreaterThan(0);
        // next-intl devolve "Notificacao.x.titulo" quando a chave não existe, e deixa
        // "{param}" literal quando o parâmetro não foi passado.
        for (const saida of [titulo, mensagem]) {
          expect(saida, texto.chave).not.toMatch(/Notificacao\./);
          expect(saida, texto.chave).not.toMatch(/\{\w+\}/);
        }
      }
    });
  }

  it("traduz o papel pelo idioma de quem recebe", async () => {
    const pt = await montarTexto("pt-BR", { chave: "papelAlterado", params: { papel: "MODERADOR" } });
    const en = await montarTexto("en", { chave: "papelAlterado", params: { papel: "ADMIN" } });

    expect(pt.mensagem).toContain("papel de Moderador");
    expect(en.mensagem).toContain("role of Administrator");
  });

  it("não perde as aspas do título da reclamação", async () => {
    const { mensagem } = await montarTexto("en", {
      chave: "reclamacaoRejeitada",
      params: { titulo: 'Poste "apagado"', motivo: "duplicada" },
    });

    expect(mensagem).toBe('Your complaint "Poste "apagado"" was rejected: duplicada');
  });
});
